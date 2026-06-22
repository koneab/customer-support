import { AiProvider } from "./AiProvider";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  private responses: Map<string, unknown>;

  constructor(responses?: Map<string, unknown>) {
    this.responses = responses ?? new Map();
  }

  async classify(message: string): Promise<unknown> {
    if (this.responses.has(message)) {
      return this.responses.get(message);
    }

    return {
      intent: "general_question",
      priority: "medium",
      needsHuman: false,
      confidence: 0.85,
      reason: "General customer inquiry",
    };
  }
}
