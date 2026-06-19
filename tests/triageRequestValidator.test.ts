import { validateTriageRequest } from "../src/validators/triageRequestValidator";

describe("validateTriageRequest", () => {
  describe("missing message field", () => {
    it("returns error when body is undefined", () => {
      const result = validateTriageRequest(undefined);
      expect(result).toEqual({ valid: false, error: "message is required" });
    });

    it("returns error when body is null", () => {
      const result = validateTriageRequest(null);
      expect(result).toEqual({ valid: false, error: "message is required" });
    });

    it("returns error when body has no message key", () => {
      const result = validateTriageRequest({ other: "field" });
      expect(result).toEqual({ valid: false, error: "message is required" });
    });

    it("returns error when body is empty object", () => {
      const result = validateTriageRequest({});
      expect(result).toEqual({ valid: false, error: "message is required" });
    });
  });

  describe("non-string message", () => {
    it("returns error when message is null", () => {
      const result = validateTriageRequest({ message: null });
      expect(result).toEqual({ valid: false, error: "message must be a string" });
    });

    it("returns error when message is a number", () => {
      const result = validateTriageRequest({ message: 123 });
      expect(result).toEqual({ valid: false, error: "message must be a string" });
    });

    it("returns error when message is a boolean", () => {
      const result = validateTriageRequest({ message: true });
      expect(result).toEqual({ valid: false, error: "message must be a string" });
    });

    it("returns error when message is an array", () => {
      const result = validateTriageRequest({ message: ["hello"] });
      expect(result).toEqual({ valid: false, error: "message must be a string" });
    });
  });

  describe("empty message", () => {
    it("returns error when message is empty string", () => {
      const result = validateTriageRequest({ message: "" });
      expect(result).toEqual({ valid: false, error: "message must not be empty" });
    });

    it("returns error when message is only whitespace", () => {
      const result = validateTriageRequest({ message: "   " });
      expect(result).toEqual({ valid: false, error: "message must not be empty" });
    });

    it("returns error when message is tabs and newlines", () => {
      const result = validateTriageRequest({ message: "\t\n  " });
      expect(result).toEqual({ valid: false, error: "message must not be empty" });
    });
  });

  describe("message too long", () => {
    it("returns error when message exceeds 5000 characters", () => {
      const result = validateTriageRequest({ message: "a".repeat(5001) });
      expect(result).toEqual({ valid: false, error: "message is too long" });
    });

    it("accepts message of exactly 5000 characters", () => {
      const result = validateTriageRequest({ message: "a".repeat(5000) });
      expect(result.valid).toBe(true);
      expect(result.message).toBe("a".repeat(5000));
    });
  });

  describe("valid message", () => {
    it("returns valid result with trimmed message", () => {
      const result = validateTriageRequest({ message: "  Hello world  " });
      expect(result).toEqual({ valid: true, message: "Hello world" });
    });

    it("returns valid result for a normal message", () => {
      const result = validateTriageRequest({ message: "I need help with billing" });
      expect(result).toEqual({ valid: true, message: "I need help with billing" });
    });
  });

  describe("non-string message (additional edge cases)", () => {
    it("returns error when message is undefined", () => {
      const result = validateTriageRequest({ message: undefined });
      expect(result).toEqual({ valid: false, error: "message must be a string" });
    });

    it("returns error when message is an object", () => {
      const result = validateTriageRequest({ message: { text: "hello" } });
      expect(result).toEqual({ valid: false, error: "message must be a string" });
    });
  });

  describe("precedence order", () => {
    it("missing takes precedence over all (non-object body)", () => {
      const result = validateTriageRequest("not an object");
      expect(result.error).toBe("message is required");
    });

    it("missing takes precedence when body is a number", () => {
      const result = validateTriageRequest(42);
      expect(result.error).toBe("message is required");
    });

    it("missing takes precedence when body is an array", () => {
      const result = validateTriageRequest([]);
      expect(result.error).toBe("message is required");
    });

    it("missing field takes precedence over non-string (no message key at all)", () => {
      // Body is an object but has no 'message' key — missing beats non-string
      const result = validateTriageRequest({ text: 123 });
      expect(result.error).toBe("message is required");
    });

    it("non-string takes precedence over empty (message is null)", () => {
      // null is non-string, but could also be considered 'empty' — non-string wins
      const result = validateTriageRequest({ message: null });
      expect(result.error).toBe("message must be a string");
    });

    it("non-string takes precedence over empty (message is 0)", () => {
      // 0 is falsy/non-string — non-string wins over empty
      const result = validateTriageRequest({ message: 0 });
      expect(result.error).toBe("message must be a string");
    });

    it("non-string takes precedence over too long (message is a large array)", () => {
      // An array with >5000 elements is non-string — non-string wins over too long
      const result = validateTriageRequest({ message: new Array(6000).fill("a") });
      expect(result.error).toBe("message must be a string");
    });

    it("empty takes precedence over too long (whitespace-only within limit)", () => {
      // A whitespace string under 5000 chars — empty wins (too long doesn't apply)
      const result = validateTriageRequest({ message: " ".repeat(100) });
      expect(result.error).toBe("message must not be empty");
    });

    it("empty takes precedence over too long (whitespace-only exceeds limit)", () => {
      // A whitespace string over 5000 chars — empty should still win per precedence order
      const result = validateTriageRequest({ message: " ".repeat(5001) });
      expect(result.error).toBe("message must not be empty");
    });

    it("too long only triggers for non-empty strings over limit", () => {
      const result = validateTriageRequest({ message: "x".repeat(5001) });
      expect(result.error).toBe("message is too long");
    });
  });
});
