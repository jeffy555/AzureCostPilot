output "id" {
  value = azurerm_storage_account.this.id
}

output "primary_blob_endpoint" {
  value = azurerm_storage_account.this.primary_blob_endpoint
}

output "primary_queue_endpoint" {
  value = azurerm_storage_account.this.primary_queue_endpoint
}

output "primary_table_endpoint" {
  value = azurerm_storage_account.this.primary_table_endpoint
}

output "primary_file_endpoint" {
  value = azurerm_storage_account.this.primary_file_endpoint
}