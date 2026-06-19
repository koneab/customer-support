export interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

const MAX_MESSAGE_LENGTH = 5000;

export function validateTriageRequest(body: unknown): ValidationResult {
  // Precedence: missing → non-string → empty → too long

  if (body === null || body === undefined || typeof body !== "object") {
    return { valid: false, error: "message is required" };
  }

  const record = body as Record<string, unknown>;

  if (!("message" in record)) {
    return { valid: false, error: "message is required" };
  }

  const message = record.message;

  if (typeof message !== "string") {
    return { valid: false, error: "message must be a string" };
  }

  if (message.trim().length === 0) {
    return { valid: false, error: "message must not be empty" };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: "message is too long" };
  }

  return { valid: true, message: message.trim() };
}
