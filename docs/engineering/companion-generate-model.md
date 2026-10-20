# cht-companion `/generate` for reports

cht-reports calls companion over Service Connect. Chatbot traffic stays on `/chat`.

- Endpoint: existing `POST /generate` (prompt in, completion out). Not `/chat` (no RAG).
- Auth: Cognito M2M Bearer `companion/generate.invoke` (same `cht-reports-m2m-*` client as Hub / Platform notify). `X-Request-Id` is the report id.
- Model: Claude Sonnet on Bedrock (same family as the chatbot). Do not add GPT-5
  for v1 reports. Optional: `model_id` override later; default Sonnet
  (`us.anthropic.claude-sonnet-5`).
- Reports caller sends: system prompt from the S3 template, `user_content` = input packet,
  temperature ~0.2, max_tokens 4096 (clamp), request JSON section schema.
- Return: `{ text, finish_reason, request_id, tokens_input, tokens_output }`.
- Daily token budget (CPR-21): companion answers 429 `token_budget_exceeded` once the org-wide day budget is used up. The worker marks the report FAILED with companion's message and does not retry it (the SQS message is deleted); other errors still retry.
- Prefer Bedrock structured outputs for section JSON when available on this model.
- Chatbot stays on `/chat` + Sonnet; different prompt, not a different vendor.
