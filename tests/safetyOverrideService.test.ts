import fc from "fast-check";
import { applySafetyOverrides } from "../src/services/safetyOverrideService";
import {
  TriageResult,
  SupportIntent,
  Priority,
  RiskFlag,
} from "../src/models/triage";

// Arbitraries for generating random TriageResult components
const supportIntentArb = fc.constantFrom<SupportIntent>(
  "billing_issue",
  "technical_issue",
  "account_access",
  "cancellation",
  "general_question"
);

const priorityArb = fc.constantFrom<Priority>("low", "medium", "high");

const riskFlagArb = fc.constantFrom<RiskFlag>(
  "prompt_injection_attempt",
  "low_confidence",
  "refund_or_payment_risk",
  "legal_or_complaint",
  "account_access_risk",
  "ai_unavailable"
);

const confidenceArb = fc.double({ min: 0, max: 1, noNaN: true });

const triageResultArb = (overrides?: Partial<TriageResult>): fc.Arbitrary<TriageResult> =>
  fc.record({
    intent: overrides?.intent ? fc.constant(overrides.intent) : supportIntentArb,
    priority: overrides?.priority ? fc.constant(overrides.priority) : priorityArb,
    needsHuman: overrides?.needsHuman !== undefined ? fc.constant(overrides.needsHuman) : fc.boolean(),
    confidence: overrides?.confidence !== undefined ? fc.constant(overrides.confidence) : confidenceArb,
    reason: fc.string({ minLength: 1, maxLength: 100 }),
    riskFlags: overrides?.riskFlags ? fc.constant(overrides.riskFlags) : fc.uniqueArray(riskFlagArb, { maxLength: 3 }),
    provider: fc.constantFrom("openai", "mock", "fallback"),
    guardrailsApplied: overrides?.guardrailsApplied
      ? fc.constant(overrides.guardrailsApplied)
      : fc.uniqueArray(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 3 }),
  });



describe("Safety Override Service - Property-Based Tests", () => {
  // Property 6: High priority forces human handoff
  // Validates: Requirements 6.1
  describe("Property 6: High priority forces human handoff", () => {
    it("should set needsHuman=true and add safety_override_human_handoff guardrail when priority is high", () => {
      fc.assert(
        fc.property(
          triageResultArb({ priority: "high" }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.boolean(),
          (result, message, injectionDetected) => {
            const output = applySafetyOverrides(result, message, injectionDetected);
            expect(output.needsHuman).toBe(true);
            expect(output.guardrailsApplied).toContain("safety_override_human_handoff");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 7: Low confidence forces human handoff
  // Validates: Requirements 6.2
  describe("Property 7: Low confidence forces human handoff", () => {
    it("should set needsHuman=true, add low_confidence risk flag, and safety_override_human_handoff guardrail when confidence < 0.7", () => {
      const lowConfidenceArb = fc.double({ min: 0, max: 0.6999999999, noNaN: true });

      fc.assert(
        fc.property(
          lowConfidenceArb,
          supportIntentArb,
          priorityArb,
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.boolean(),
          (confidence, intent, priority, message, injectionDetected) => {
            const result: TriageResult = {
              intent,
              priority,
              needsHuman: false,
              confidence,
              reason: "test reason",
              riskFlags: [],
              provider: "mock",
              guardrailsApplied: [],
            };

            const output = applySafetyOverrides(result, message, injectionDetected);
            expect(output.needsHuman).toBe(true);
            expect(output.riskFlags).toContain("low_confidence");
            expect(output.guardrailsApplied).toContain("safety_override_human_handoff");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 8: Financial risk detection and escalation
  // Validates: Requirements 6.3, 6.4
  describe("Property 8: Financial risk detection and escalation", () => {
    const financialPhrases = ["refund", "payment dispute", "money back", "charged twice", "billing error"];

    it("should set needsHuman=true and add refund_or_payment_risk flag for financial phrases", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...financialPhrases),
          triageResultArb({ confidence: 0.9 }),
          fc.boolean(),
          (phrase, result, injectionDetected) => {
            const message = `I need help with ${phrase} on my account`;
            const output = applySafetyOverrides(result, message, injectionDetected);
            expect(output.needsHuman).toBe(true);
            expect(output.riskFlags).toContain("refund_or_payment_risk");
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should set priority to high when message contains 'charged twice'", () => {
      fc.assert(
        fc.property(
          triageResultArb({ confidence: 0.9 }),
          fc.boolean(),
          (result, injectionDetected) => {
            const message = "I was charged twice for my subscription";
            const output = applySafetyOverrides(result, message, injectionDetected);
            expect(output.priority).toBe("high");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 9: Legal/complaint risk detection
  // Validates: Requirements 6.5
  describe("Property 9: Legal/complaint risk detection", () => {
    const legalPhrases = ["legal action", "lawyer", "lawsuit", "complaint", "attorney", "sue"];

    it("should set needsHuman=true and add legal_or_complaint flag for legal phrases", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...legalPhrases),
          triageResultArb({ confidence: 0.9 }),
          fc.boolean(),
          (phrase, result, injectionDetected) => {
            const message = `I will take ${phrase} if this is not resolved`;
            const output = applySafetyOverrides(result, message, injectionDetected);
            expect(output.needsHuman).toBe(true);
            expect(output.riskFlags).toContain("legal_or_complaint");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 10: Account access risk detection
  // Validates: Requirements 6.6
  describe("Property 10: Account access risk detection", () => {
    const accessPhrases = ["account locked", "cannot access", "locked out", "can't access"];

    it("should set needsHuman=true and add account_access_risk flag for access phrases", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...accessPhrases),
          triageResultArb({ confidence: 0.9 }),
          fc.boolean(),
          (phrase, result, injectionDetected) => {
            const message = `Help, my ${phrase} and I need it fixed`;
            const output = applySafetyOverrides(result, message, injectionDetected);
            expect(output.needsHuman).toBe(true);
            expect(output.riskFlags).toContain("account_access_risk");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 11: Urgency keywords set high priority
  // Validates: Requirements 6.7
  describe("Property 11: Urgency keywords set high priority", () => {
    const urgencyKeywords = [
      "urgent", "asap", "immediately", "charged twice",
      "legal", "complaint", "cannot access", "locked out", "production down",
    ];

    it("should set priority to high for messages with urgency keywords", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...urgencyKeywords),
          triageResultArb({ confidence: 0.9 }),
          fc.boolean(),
          (keyword, result, injectionDetected) => {
            const message = `This is ${keyword} please help me now`;
            const output = applySafetyOverrides(result, message, injectionDetected);
            expect(output.priority).toBe("high");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 12: Cumulative safety overrides
  // Validates: Requirements 6.10
  describe("Property 12: Cumulative safety overrides", () => {
    it("should apply all matching rules cumulatively when multiple triggers are present", () => {
      // Use "complaint" as the legal phrase since it's also an urgency keyword that triggers high priority
      const financialPhrase = fc.constantFrom("refund", "payment dispute", "money back", "billing error");
      // "complaint" is both a legal phrase AND an urgency keyword
      const legalUrgencyPhrase = fc.constantFrom("complaint");

      fc.assert(
        fc.property(
          financialPhrase,
          legalUrgencyPhrase,
          triageResultArb({ confidence: 0.9, riskFlags: [], guardrailsApplied: [] }),
          (finPhrase, legPhrase, result) => {
            const message = `I want a ${finPhrase} and I have a ${legPhrase}`;
            const output = applySafetyOverrides(result, message, false);

            // Both risk flags should be present
            expect(output.riskFlags).toContain("refund_or_payment_risk");
            expect(output.riskFlags).toContain("legal_or_complaint");
            // needsHuman must be true (both rules require it)
            expect(output.needsHuman).toBe(true);
            // Priority should be high ("complaint" is an urgency keyword)
            expect(output.priority).toBe("high");
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should combine account access + financial risk flags and preserve highest priority", () => {
      // Use access phrases that are also urgency keywords: "cannot access", "locked out"
      const accessUrgencyPhrase = fc.constantFrom("cannot access", "locked out");
      const financialPhrase = fc.constantFrom("refund", "payment dispute", "money back", "billing error");

      fc.assert(
        fc.property(
          accessUrgencyPhrase,
          financialPhrase,
          triageResultArb({ priority: "low", confidence: 0.9, riskFlags: [], guardrailsApplied: [] }),
          (accPhrase, finPhrase, result) => {
            const message = `I ${accPhrase} my account and I need a ${finPhrase}`;
            const output = applySafetyOverrides(result, message, false);

            // Both risk flags should be present
            expect(output.riskFlags).toContain("account_access_risk");
            expect(output.riskFlags).toContain("refund_or_payment_risk");
            // needsHuman must be true
            expect(output.needsHuman).toBe(true);
            // Priority should be high due to urgency keywords ("cannot access", "locked out")
            expect(output.priority).toBe("high");
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
