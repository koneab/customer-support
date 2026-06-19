import { z } from "zod";

export const SupportIntentSchema = z.enum([
  "billing_issue",
  "technical_issue",
  "account_access",
  "cancellation",
  "general_question",
]);

export const PrioritySchema = z.enum(["low", "medium", "high"]);

export const AiResponseSchema = z.object({
  intent: SupportIntentSchema,
  priority: PrioritySchema,
  needsHuman: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(500),
});

export const TriageResultSchema = z.object({
  intent: SupportIntentSchema,
  priority: PrioritySchema,
  needsHuman: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(500),
  riskFlags: z.array(z.string()),
  provider: z.string(),
  guardrailsApplied: z.array(z.string()),
});
