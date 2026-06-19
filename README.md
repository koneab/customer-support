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
npm run start      # Run production server
npm run typecheck  # Type checking
npm run test       # Run tests
npm run lint       # Lint
```

## Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/health` | Health check | ✅ Returns `{"status": "ok"}` |
| POST | `/triage` | Classify a support message | 🚧 Validation implemented, classification pending |

### POST /triage

**Request body:**
```json
{ "message": "Your support message here" }
```

**Validation errors (400):**
- Missing message → `{"error": "message is required"}`
- Non-string message → `{"error": "message must be a string"}`
- Empty/whitespace message → `{"error": "message must not be empty"}`
- Message > 5000 chars → `{"error": "message is too long"}`

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes (prod) | — | API key for OpenAI-compatible service |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | Model identifier |
| `AI_PROVIDER` | No | `mock` | `"openai"` or `"mock"` |
| `AI_TIMEOUT_MS` | No | `5000` | AI call timeout in ms |
| `PORT` | No | `3000` | Server listen port |

## What's Implemented

- [x] Express server with health endpoint
- [x] Request validation for POST /triage (presence, type, empty, length checks)
- [x] Error handling middleware (400, 404, 500 — no internals exposed)
- [x] Unit tests for request validator
- [x] AI Provider interface (`AiProvider` with `classify(message): Promise<unknown>`)
- [x] Mock AI Provider (preconfigured responses for testing/local dev)
- [x] Fallback Classifier (deterministic safe result, routes to human)
- [x] Prompt Injection Detector (case-insensitive substring matching against 11 known phrases)
- [ ] Safety overrides
- [ ] AI classification pipeline (Triage Service)
- [ ] OpenAI provider integration
