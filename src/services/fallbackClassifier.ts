import { TriageResult } from "../models/triage";

export function classifyFallback(): TriageResult {
  return {
    intent: "general_question",
    priority: "medium",
    needsHuman: true,
    confidence: 0.4,
    reason: "Fallback classification used due to AI provider unavailability",
    riskFlags: ["ai_unavailable"],
    provider: "fallback",
    guardrailsApplied: ["fallback_classifier", "safe_human_handoff"],
  };
}
