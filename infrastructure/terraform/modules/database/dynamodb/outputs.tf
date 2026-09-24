output "table_name" {
  value = aws_dynamodb_table.report_generation_state.name
}

output "table_arn" {
  value = aws_dynamodb_table.report_generation_state.arn
}

output "campaign_index_name" {
  value = "campaign_id-created_at-index"
}
