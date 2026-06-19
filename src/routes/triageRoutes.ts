import { Router, Request, Response } from "express";
import { validateTriageRequest } from "../validators/triageRequestValidator.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

router.post("/triage", (req: Request, res: Response) => {
  const result = validateTriageRequest(req.body);

  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(501).json({ error: "not implemented" });
});

export default router;
