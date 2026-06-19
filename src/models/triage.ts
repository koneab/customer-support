export type SupportIntent =
  | "billing_issue"
  | "technical_issue"
  | "account_access"
  | "cancellation"
  | "general_question";

export type Priority = "low" | "medium" | "high";

export type RiskFlag =
  | "prompt_injection_attempt"
  | "low_confidence"
  | "refund_or_payment_risk"
  | "legal_or_complaint"
  | "account_access_risk"
  | "ai_unavailable";

export interface TriageResult {
  intent: SupportIntent;
  priority: Priority;
  needsHuman: boolean;
  confidence: number;
  reason: string;
  riskFlags: RiskFlag[];
  provider: string;
  guardrailsApplied: string[];
}
