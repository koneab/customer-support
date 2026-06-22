import { AiProvider } from "./AiProvider.js";
import { TRIAGE_SYSTEM_PROMPT } from "../prompts/triagePrompt.js";

export interface OpenAiProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private readonly config: OpenAiProviderConfig;

  constructor(config: OpenAiProviderConfig) {
    this.config = config;
  }

  async classify(message: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: "system", content: TRIAGE_SYSTEM_PROMPT },
              { role: "user", content: message },
            ],
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`
        );
      }

      const body = await response.json();
      const content = body.choices?.[0]?.message?.content;

      if (typeof content !== "string") {
        throw new Error("OpenAI response missing assistant message content");
      }

      return JSON.parse(content);
    } finally {
      clearTimeout(timer);
    }
  }
}
