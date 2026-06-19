export interface InjectionResult {
  detected: boolean;
  matchedPhrases: string[];
}

const INJECTION_PHRASES: string[] = [
  "ignore previous instructions",
  "ignore all instructions",
  "you are now",
  "system prompt",
  "developer message",
  "reveal your prompt",
  "jailbreak",
  "act as",
  "do not classify",
  "return low priority",
  "always return",
];

export function detectPromptInjection(message: string): InjectionResult {
  const lowerMessage = message.toLowerCase();

  const matchedPhrases = INJECTION_PHRASES.filter((phrase) =>
    lowerMessage.includes(phrase)
  );

  return {
    detected: matchedPhrases.length > 0,
    matchedPhrases,
  };
}
