# CHT Reports — generator Lambda

Containerized Lambda that will produce report artifacts. The handler is a scaffold: it accepts EventBridge, SQS, and direct invoke events and returns a JSON result.

Replace `handler.py` with real generation (Content Hub snapshots, PDF/JSON upload to `REPORTS_BUCKET`) when product work starts.

## Local

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

## Image

```bash
docker build -t cht-reports-generator:local .
```

Runtime: AWS Lambda Python 3.12 container (`public.ecr.aws/lambda/python:3.12`).
CMD: `handler.handler`.
