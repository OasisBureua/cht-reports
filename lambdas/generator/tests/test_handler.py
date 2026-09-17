import json
from types import SimpleNamespace

from handler import handler


def test_handler_direct_invoke():
    result = handler({"source": "smoke"}, SimpleNamespace(aws_request_id="test-1"))
    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["ok"] is True
    assert body["lambda"] == "generator"
    assert body["source"] == "smoke"
    assert body["request_id"] == "test-1"


def test_handler_eventbridge():
    result = handler(
        {"source": "aws.events", "detail-type": "Scheduled Event"},
        SimpleNamespace(aws_request_id="eb-1"),
    )
    body = json.loads(result["body"])
    assert body["source"] == "eventbridge"


def test_handler_sqs():
    result = handler(
        {"Records": [{"messageId": "m1", "body": "{}"}]},
        SimpleNamespace(aws_request_id="sqs-1"),
    )
    body = json.loads(result["body"])
    assert body["source"] == "sqs"
