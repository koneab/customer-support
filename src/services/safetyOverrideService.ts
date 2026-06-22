import { Priority, RiskFlag, TriageResult } from "../models/triage";

const FINANCIAL_PHRASES = [
  "refund",
  "payment dispute",
  "money back",
  "charged twice",
  "billing error",
];

const LEGAL_PHRASES = [
  "legal action",
  "lawyer",
  "lawsuit",
  "complaint",
  "attorney",
  "sue",
];

const ACCOUNT_ACCESS_PHRASES = [
  "account locked",
  "cannot access",
  "locked out",
  "can't access",
];

const URGENCY_KEYWORDS = [
  "urgent",
  "asap",
  "immediately",
  "charged twice",
  "legal",
  "complaint",
  "cannot access",
  "locked out",
  "production down",
];

const PRIORITY_ORDER: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function highestPriority(a: Priority, b: Priority): Priority {
  return PRIORITY_ORDER[a] >= PRIORITY_ORDER[b] ? a : b;
}

function containsAny(message: string, phrases: string[]): boolean {
  const lower = message.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase));
}

export function applySafetyOverrides(
  result: TriageResult,
  message: string,
  injectionDetected: boolean
): TriageResult {
  let { priority, needsHuman } = result;
  const riskFlags: RiskFlag[] = [...result.riskFlags];
  const guardrailsApplied: string[] = [...result.guardrailsApplied];

  // Rule: High priority → needsHuman + guardrail
  if (priority === "high") {
    needsHuman = true;
    if (!guardrailsApplied.includes("safety_override_human_handoff")) {
      guardrailsApplied.push("safety_override_human_handoff");
    }
  }

  // Rule: Confidence < 0.7 → needsHuman + low_confidence flag + guardrail
  if (result.confidence < 0.7) {
    needsHuman = true;
    if (!riskFlags.includes("low_confidence")) {
      riskFlags.push("low_confidence");
    }
    if (!guardrailsApplied.includes("safety_override_human_handoff")) {
      guardrailsApplied.push("safety_override_human_handoff");
    }
  }

  // Rule: Financial phrases → needsHuman + refund_or_payment_risk flag
  if (containsAny(message, FINANCIAL_PHRASES)) {
    needsHuman = true;
    if (!riskFlags.includes("refund_or_payment_risk")) {
      riskFlags.push("refund_or_payment_risk");
    }
  }

  // Rule: "charged twice" → priority high
  if (message.toLowerCase().includes("charged twice")) {
    priority = highestPriority(priority, "high");
  }

  // Rule: Legal phrases → needsHuman + legal_or_complaint flag
  if (containsAny(message, LEGAL_PHRASES)) {
    needsHuman = true;
    if (!riskFlags.includes("legal_or_complaint")) {
      riskFlags.push("legal_or_complaint");
    }
  }

  // Rule: Account access phrases → needsHuman + account_access_risk flag
  if (containsAny(message, ACCOUNT_ACCESS_PHRASES)) {
    needsHuman = true;
    if (!riskFlags.includes("account_access_risk")) {
      riskFlags.push("account_access_risk");
    }
  }

  // Rule: Urgency keywords → priority high
  if (containsAny(message, URGENCY_KEYWORDS)) {
    priority = highestPriority(priority, "high");
  }

  // Rule: Injection detected → needsHuman
  if (injectionDetected) {
    needsHuman = true;
  }

  // Rule: Fallback used (provider === "fallback") → needsHuman
  if (result.provider === "fallback") {
    needsHuman = true;
  }

  // After all priority escalations, if priority became high, ensure human handoff guardrail
  if (priority === "high" && !guardrailsApplied.includes("safety_override_human_handoff")) {
    needsHuman = true;
    guardrailsApplied.push("safety_override_human_handoff");
  }

  return {
    ...result,
    priority,
    needsHuman,
    riskFlags,
    guardrailsApplied,
  };
}
