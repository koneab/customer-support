import fc from "fast-check";
import request from "supertest";
import { TriageService } from "../src/services/triageService";
import { TriageResultSchema } from "../src/schemas/triageSchemas";
import { AiProvider } from "../src/providers/AiProvider";
import { SupportIntent, Priority } from "../src/models/triage";
import app from "../src/app";

// --- Arbitraries ---

const validIntentArb = fc.constantFrom<SupportIntent>(
  "billing_issue",
  "technical_issue",
  "account_access",
  "cancellation",
  "general_question"
);

const validPriorityArb = fc.constantFrom<Priority>("low", "medium", "high");

const validConfidenceArb = fc.double({ min: 0, max: 1, noNaN: true });

const validReasonArb = fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0);

// Generate valid customer messages (non-empty, non-whitespace, ≤5000 chars)
const validMessageArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

// Valid AI response object
const validAiResponseArb = fc.record({
  intent: validIntentArb,
  priority: validPriorityArb,
  needsHuman: fc.boolean(),
  confidence: validConfidenceArb,
  reason: validReasonArb,
});

// --- Custom AiProvider implementations ---

class FixedResponseProvider implements AiProvider {
  readonly name = "test";
  constructor(private response: unknown) {}
  async classify(_message: string): Promise<unknown> {
    return this.response;
  }
}

class ErrorProvider implements AiProvider {
  readonly name = "test";
  async classify(_message: string): Promise<unknown> {
    throw new Error("AI provider error");
  }
}

class TimeoutProvider implements AiProvider {
  readonly name = "test";
  async classify(_message: string): Promise<unknown> {
    // This provider never resolves within the service timeout window.
    // The TriageService's Promise.race timeout will reject first.
    return new Promise(() => {
      // intentionally never resolves
    });
  }
}

// --- Property Tests ---

describe("Triage Service - Property-Based Tests", () => {
  // Property 1: Output structure invariant
  // Validates: Requirements 3.1, 10.1
  describe("Property 1: Output structure invariant", () => {
    it("should return a valid TriageResult for valid AI responses", async () => {
      await fc.assert(
        fc.asyncProperty(
          validMessageArb,
          validAiResponseArb,
          async (message, aiResponse) => {
            const provider = new FixedResponseProvider(aiResponse);
            const service = new TriageService(provider, 5000);
            const result = await service.triage(message);

            const validation = TriageResultSchema.safeParse(result);
            expect(validation.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return a valid TriageResult when AI returns invalid response", async () => {
      const invalidResponseArb = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.constant("not json object"),
        fc.constant(42),
        fc.constant({ intent: "unknown_intent" }),
        fc.record({
          intent: fc.constant("billing_issue"),
          priority: fc.constant("invalid_priority"),
        })
      );

      await fc.assert(
        fc.asyncProperty(
          validMessageArb,
          invalidResponseArb,
          async (message, invalidResponse) => {
            const provider = new FixedResponseProvider(invalidResponse);
            const service = new TriageService(provider, 5000);
            const result = await service.triage(message);

            const validation = TriageResultSchema.safeParse(result);
            expect(validation.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should return a valid TriageResult when AI throws an error", async () => {
      await fc.assert(
        fc.asyncProperty(validMessageArb, async (message) => {
          const provider = new ErrorProvider();
          const service = new TriageService(provider, 5000);
          const result = await service.triage(message);

          const validation = TriageResultSchema.safeParse(result);
          expect(validation.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it("should return a valid TriageResult when AI times out", async () => {
      jest.useFakeTimers();
      try {
        await fc.assert(
          fc.asyncProperty(validMessageArb, async (message) => {
            const provider = new TimeoutProvider();
            const service = new TriageService(provider, 10); // 10ms timeout
            const triagePromise = service.triage(message);
            jest.advanceTimersByTime(50);
            const result = await triagePromise;

            const validation = TriageResultSchema.safeParse(result);
            expect(validation.success).toBe(true);
          }),
          { numRuns: 100 }
        );
      } finally {
        jest.useRealTimers();
      }
    }, 30000);
  });

  // Property 4: Invalid AI response triggers fallback
  // Validates: Requirements 3.6, 4.3, 4.4, 4.5
  describe("Property 4: Invalid AI response triggers fallback", () => {
    // Generate various kinds of invalid AI responses
    const invalidAiResponseArb = fc.oneof(
      // Missing required fields
      fc.record({
        intent: validIntentArb,
        // missing priority, needsHuman, confidence, reason
      }),
      fc.record({
        priority: validPriorityArb,
        // missing other fields
      }),
      // Intent not in allowed set
      fc.record({
        intent: fc.string({ minLength: 3, maxLength: 20 }).filter(
          (s) => !["billing_issue", "technical_issue", "account_access", "cancellation", "general_question"].includes(s)
        ),
        priority: validPriorityArb,
        needsHuman: fc.boolean(),
        confidence: validConfidenceArb,
        reason: validReasonArb,
      }),
      // Priority not in allowed set
      fc.record({
        intent: validIntentArb,
        priority: fc.string({ minLength: 3, maxLength: 20 }).filter(
          (s) => !["low", "medium", "high"].includes(s)
        ),
        needsHuman: fc.boolean(),
        confidence: validConfidenceArb,
        reason: validReasonArb,
      }),
      // Confidence outside [0, 1]
      fc.record({
        intent: validIntentArb,
        priority: validPriorityArb,
        needsHuman: fc.boolean(),
        confidence: fc.oneof(
          fc.double({ min: 1.01, max: 100, noNaN: true }),
          fc.double({ min: -100, max: -0.01, noNaN: true })
        ),
        reason: validReasonArb,
      }),
      // Empty reason
      fc.record({
        intent: validIntentArb,
        priority: validPriorityArb,
        needsHuman: fc.boolean(),
        confidence: validConfidenceArb,
        reason: fc.constant(""),
      })
    );

    it("should trigger fallback with schema_validation_failed for invalid AI responses", async () => {
      await fc.assert(
        fc.asyncProperty(
          validMessageArb,
          invalidAiResponseArb,
          async (message, invalidResponse) => {
            const provider = new FixedResponseProvider(invalidResponse);
            const service = new TriageService(provider, 5000);
            const result = await service.triage(message);

            expect(result.provider).toBe("fallback");
            expect(result.guardrailsApplied).toContain("schema_validation_failed");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 13: Causal language hallucination rejection
  // Validates: Requirements 4.6, 4.7, 4.8
  describe("Property 13: Causal language hallucination rejection", () => {
    const CAUSAL_PHRASES = [
      "caused by",
      "because",
      "due to",
      "the root cause is",
      "this is happening because",
    ];

    // Generate messages that do NOT contain any causal phrases
    const messageSafeFromCausalArb = fc
      .string({ minLength: 1, maxLength: 200 })
      .filter((s) => {
        const lower = s.toLowerCase();
        return (
          s.trim().length > 0 &&
          !CAUSAL_PHRASES.some((phrase) => lower.includes(phrase))
        );
      });

    // Generate a reason that DOES contain a causal phrase
    const reasonWithCausalArb = fc
      .tuple(
        fc.constantFrom(...CAUSAL_PHRASES),
        fc.string({ minLength: 1, maxLength: 50 })
      )
      .map(([phrase, suffix]) => `This issue is ${phrase} ${suffix}`.slice(0, 500))
      .filter(s => s.trim().length > 0);

    it("should reject AI responses with causal language not present in customer message", async () => {
      await fc.assert(
        fc.asyncProperty(
          messageSafeFromCausalArb,
          validIntentArb,
          validPriorityArb,
          fc.boolean(),
          validConfidenceArb,
          reasonWithCausalArb,
          async (message, intent, priority, needsHuman, confidence, reason) => {
            const aiResponse = { intent, priority, needsHuman, confidence, reason };
            const provider = new FixedResponseProvider(aiResponse);
            const service = new TriageService(provider, 5000);
            const result = await service.triage(message);

            expect(result.provider).toBe("fallback");
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 14: Validation failure short-circuits pipeline
  // Validates: Requirements 12.2
  describe("Property 14: Validation failure short-circuits pipeline", () => {
    it("should return 400 for missing message field", async () => {
      const invalidBodiesArb = fc.oneof(
        // No message field at all
        fc.record({ data: fc.string() }),
        // Empty object
        fc.constant({})
      );

      await fc.assert(
        fc.asyncProperty(invalidBodiesArb, async (body) => {
          const response = await request(app).post("/triage").send(body);
          expect(response.status).toBe(400);
          expect(response.body).toHaveProperty("error");
          // Should NOT have TriageResult fields (short-circuited before triage)
          expect(response.body).not.toHaveProperty("intent");
          expect(response.body).not.toHaveProperty("provider");
        }),
        { numRuns: 100 }
      );
    });

    it("should return 400 for non-string message", async () => {
      const nonStringMessageArb = fc.oneof(
        fc.integer().map((n) => ({ message: n })),
        fc.boolean().map((b) => ({ message: b })),
        fc.constant({ message: null }),
        fc.constant({ message: [] }),
        fc.constant({ message: {} })
      );

      await fc.assert(
        fc.asyncProperty(nonStringMessageArb, async (body) => {
          const response = await request(app).post("/triage").send(body);
          expect(response.status).toBe(400);
          expect(response.body).toHaveProperty("error");
          expect(response.body).not.toHaveProperty("intent");
          expect(response.body).not.toHaveProperty("provider");
        }),
        { numRuns: 100 }
      );
    });

    it("should return 400 for empty or whitespace-only message", async () => {
      const emptyMessageArb = fc.oneof(
        fc.constant({ message: "" }),
        fc.stringOf(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 50 }).map(
          (ws) => ({ message: ws })
        )
      );

      await fc.assert(
        fc.asyncProperty(emptyMessageArb, async (body) => {
          const response = await request(app).post("/triage").send(body);
          expect(response.status).toBe(400);
          expect(response.body).toHaveProperty("error");
          expect(response.body).not.toHaveProperty("intent");
          expect(response.body).not.toHaveProperty("provider");
        }),
        { numRuns: 100 }
      );
    });

    it("should return 400 for message exceeding 5000 characters", async () => {
      const longMessageArb = fc
        .string({ minLength: 5001, maxLength: 6000 })
        .map((s) => ({ message: s }));

      await fc.assert(
        fc.asyncProperty(longMessageArb, async (body) => {
          const response = await request(app).post("/triage").send(body);
          expect(response.status).toBe(400);
          expect(response.body).toHaveProperty("error");
          expect(response.body).not.toHaveProperty("intent");
          expect(response.body).not.toHaveProperty("provider");
        }),
        { numRuns: 100 }
      );
    });
  });
});
