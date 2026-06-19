import { Router, Request, Response } from "express";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

router.post("/triage", (_req: Request, res: Response) => {
  res.status(501).json({ error: "not implemented" });
});

export default router;
