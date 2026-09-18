# CHT Reports API

NestJS SQS worker. Feature code lives under `src/reports/` (packet, preprocess,
orchestrator, state, render). Shared AWS SDK clients: `src/aws/`. Companion
`/generate` client: `src/companion/`.

```bash
npm ci
cp .env.example .env
npm run start:dev
```

- Health: http://localhost:3000/health
- Ready: http://localhost:3000/health/ready
