import { AiProvider } from "../providers/AiProvider.js";
import { AiResponseSchema } from "../schemas/triageSchemas.js";
import { classifyFallback } from "./fallbackClassifier.js";
import { detectPromptInjection } from "./promptInjectionDetector.js";
import { applySafetyOverrides } from "./safetyOverrideService.js";
import { TriageResult } from "../models/triage.js";

const CAUSAL_PHRASES = [
  "caused by",
  "because",
  "due to",
  "the root cause is",
  "this is happening because",
];

function containsCausalHallucination(
  reason: string,
  customerMessage: string
): boolean {
  const lowerReason = reason.toLowerCase();
  const lowerMessage = customerMessage.toLowerCase();

  for (const phrase of CAUSAL_PHRASES) {
    if (lowerReason.includes(phrase) && !lowerMessage.includes(phrase)) {
      return true;
    }
  }

  return false;
}

export class TriageService {
  private provider: AiProvider;
  private timeoutMs: number;

  constructor(provider: AiProvider, timeoutMs?: number) {
    this.provider = provider;
    this.timeoutMs = timeoutMs ?? this.getDefaultTimeout();
  }

  private getDefaultTimeout(): number {
    const envTimeout = process.env.AI_TIMEOUT_MS;
    if (envTimeout) {
      const parsed = parseInt(envTimeout, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 5000;
  }

  async triage(message: string): Promise<TriageResult> {
    // Step 1: Detect prompt injection
    const injectionResult = detectPromptInjection(message);

    // Step 2: Call AI provider with timeout
    let result: TriageResult;
    let usedFallback = false;

    try {
      const rawResponse = await this.callWithTimeout(message);

      // Step 3: Parse AI response as JSON (if it's a string, parse it)
      let parsed: unknown;
      if (typeof rawResponse === "string") {
        try {
          parsed = JSON.parse(rawResponse);
        } catch {
          // Invalid JSON string → fallback
          result = classifyFallback();
          result = {
            ...result,
            guardrailsApplied: [
              ...result.guardrailsApplied,
              "schema_validation_failed",
            ],
          };
          usedFallback = true;
          parsed = null;
        }
      } else {
        parsed = rawResponse;
      }

      if (!usedFallback) {
        // Step 4: Validate with Zod AiResponseSchema
        const validation = AiResponseSchema.safeParse(parsed);

        if (!validation.success) {
          // Step 5: Invalid → use fallback + add "schema_validation_failed"
          result = classifyFallback();
          result = {
            ...result,
            guardrailsApplied: [
              ...result.guardrailsApplied,
              "schema_validation_failed",
            ],
          };
          usedFallback = true;
        } else {
          // Step 6: Valid → check for hallucination (causal language)
          const aiData = validation.data;

          if (containsCausalHallucination(aiData.reason, message)) {
            // Step 7: Hallucinated → use fallback
            result = classifyFallback();
            usedFallback = true;
          } else {
            // Build TriageResult from validated AI response
            result = {
              intent: aiData.intent,
              priority: aiData.priority,
              needsHuman: aiData.needsHuman,
              confidence: aiData.confidence,
              reason: aiData.reason,
              riskFlags: [],
              provider: this.provider.name,
              guardrailsApplied: [],
            };
          }
        }
      }
    } catch {
      // AI error or timeout → fallback
      result = classifyFallback();
      usedFallback = true;
    }

    // Step 8: If injection detected → add risk flag and guardrail
    if (injectionResult.detected) {
      if (!result!.riskFlags.includes("prompt_injection_attempt")) {
        result = {
          ...result!,
          riskFlags: [...result!.riskFlags, "prompt_injection_attempt"],
        };
      }
      if (!result!.guardrailsApplied.includes("prompt_injection_detected")) {
        result = {
          ...result!,
          guardrailsApplied: [
            ...result!.guardrailsApplied,
            "prompt_injection_detected",
          ],
        };
      }
    }

    // Step 9: Apply safety overrides (passing injectionDetected flag)
    result = applySafetyOverrides(result!, message, injectionResult.detected);

    // Step 10: Return final TriageResult
    return result;
  }

  private callWithTimeout(message: string): Promise<unknown> {
    return Promise.race([
      this.provider.classify(message),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI provider timeout")), this.timeoutMs)
      ),
    ]);
  }
}
