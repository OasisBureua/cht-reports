output "table_name" {
  value = aws_dynamodb_table.report_generation_state.name
}

output "table_arn" {
  value = aws_dynamodb_table.report_generation_state.arn
}

output "report_index_name" {
  value = "report_id-index"
}
