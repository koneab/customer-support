# Customer Support Triage API

A TypeScript/Express backend API that classifies customer support messages using an LLM and applies deterministic backend guardrails before returning a structured triage decision.

## Setup

```bash
npm install
```

## Scripts

```bash
npm run dev        # Development server with watch mode
npm run build      # Compile TypeScript to dist/
npm run start      # Run production build
npm run typecheck  # Type checking without emit
npm run test       # Run tests
npm run lint       # ESLint
```

## Endpoints

| Method | Path     | Description                          |
|--------|----------|--------------------------------------|
| GET    | /health  | Health check → `{"status": "ok"}`    |
| POST   | /triage  | Classify a customer support message  |

### POST /triage

Request body:
```json
{ "message": "I need help with my account" }
```

Successful response (200):
```json
{
  "intent": "account_access",
  "priority": "medium",
  "needsHuman": false,
  "confidence": 0.85,
  "reason": "Customer requesting account help",
  "riskFlags": [],
  "provider": "mock",
  "guardrailsApplied": []
}
```

## Environment Variables

| Variable        | Required   | Default    | Description                        |
|----------------|------------|------------|------------------------------------|
| PORT           | No         | 3000       | Server listen port                 |
| AI_PROVIDER    | No         | mock       | "openai" or "mock"                 |
| AI_TIMEOUT_MS  | No         | 5000       | AI call timeout in milliseconds    |
| OPENAI_API_KEY | Yes (prod) | —          | API key for OpenAI-compatible API  |
| OPENAI_MODEL   | No         | gpt-4o-mini| Model identifier                   |

## Implemented

- Express server with health endpoint
- Request validation (presence, type, empty, length)
- Prompt injection detection (case-insensitive phrase matching)
- Safety override service (financial, legal, account access, urgency rules)
- Fallback classifier (deterministic safe result)
- AI provider interface with mock and OpenAI implementations
- OpenAI provider (chat completions API, AbortController timeout, error handling)
- Triage prompt template for LLM classification
- Triage service pipeline (injection detection → AI call with timeout → schema validation → hallucination check → safety overrides)
- POST /triage fully wired end-to-end with provider selection (AI_PROVIDER env var)
- Property-based tests for triage service (output structure, fallback on invalid AI, hallucination rejection, validation short-circuit)
- Property-based tests for safety overrides, prompt injection detection
- Unit tests for request validation
