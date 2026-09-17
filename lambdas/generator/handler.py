"""Report generator Lambda handler.

Scaffold: accepts EventBridge, SQS, and direct invokes. Real report build
logic (Content Hub snapshots, S3 artifacts) lands in this module later.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _event_source(event: dict[str, Any]) -> str:
    if event.get("source") == "aws.events" or event.get("detail-type"):
        return "eventbridge"
    if "Records" in event:
        return "sqs"
    return str(event.get("source") or "invoke")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    source = _event_source(event)
    request_id = getattr(context, "aws_request_id", "local")
    environment = os.environ.get("ENVIRONMENT", "local")
    bucket = os.environ.get("REPORTS_BUCKET", "")

    logger.info(
        "generator invoked source=%s env=%s request_id=%s bucket=%s",
        source,
        environment,
        request_id,
        bucket or "(unset)",
    )

    body = {
        "ok": True,
        "lambda": "generator",
        "source": source,
        "environment": environment,
        "request_id": request_id,
    }
    return {
        "statusCode": 200,
        "body": json.dumps(body),
    }
