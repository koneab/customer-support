import { Router, Request, Response, NextFunction } from "express";
import { validateTriageRequest } from "../validators/triageRequestValidator.js";
import { TriageService } from "../services/triageService.js";
import { MockAiProvider } from "../providers/MockAiProvider.js";
import { OpenAiProvider } from "../providers/OpenAiProvider.js";
import { AiProvider } from "../providers/AiProvider.js";

function createAiProvider(): AiProvider {
  const providerName = process.env.AI_PROVIDER ?? "mock";

  switch (providerName) {
    case "openai": {
      console.log("OPENAI IN");
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY environment variable is required when AI_PROVIDER is set to openai"
        );
      }
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS ?? "", 10);
      return new OpenAiProvider({
        apiKey,
        model,
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 5000,
      });
    }
    case "mock":
    default:
      return new MockAiProvider();
  }
}

const provider = createAiProvider();
const triageService = new TriageService(provider);

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

router.post(
  "/triage",
  async (req: Request, res: Response, next: NextFunction) => {
    const result = validateTriageRequest(req.body);

    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }

    try {
      const triageResult = await triageService.triage(result.message!);
      res.status(200).json(triageResult);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
