# cht-companion `/generate` for reports

cht-reports calls companion over Service Connect. Chatbot traffic stays on `/chat`.

- Endpoint: existing `POST /generate` (prompt in, completion out). Not `/chat` (no RAG).
- Auth: `X-BFF-Auth` as today.
- Model: Claude Sonnet on Bedrock (same family as the chatbot). Do not add GPT-5
  for v1 reports. Optional: `model_id` override later; default Sonnet
  (`us.anthropic.claude-sonnet-5`).
- Reports caller sends: system prompt from the S3 template, `user_content` = input packet,
  temperature ~0.2, max_tokens 4096 (clamp), request JSON section schema.
- Return: `{ text, finish_reason, request_id, tokens_input, tokens_output }`.
- Prefer Bedrock structured outputs for section JSON when available on this model.
- Chatbot stays on `/chat` + Sonnet; different prompt, not a different vendor.
