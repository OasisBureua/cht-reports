resource "aws_cloudwatch_event_rule" "generate" {
  name                = "${var.resource_prefix}-generate-schedule"
  description         = "Scheduled report generation"
  schedule_expression = var.schedule_expression
  state               = var.enabled ? "ENABLED" : "DISABLED"

  tags = {
    Name        = "${var.resource_prefix}-generate-schedule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "generate" {
  rule      = aws_cloudwatch_event_rule.generate.name
  target_id = "GeneratorLambda"
  arn       = var.lambda_alias_arn

  input = jsonencode({
    source = "eventbridge.schedule"
    type   = "GENERATE_REPORTS"
  })
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeGenerate"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  qualifier     = "live"
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.generate.arn
}
