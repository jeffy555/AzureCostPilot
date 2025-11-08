resource "azurerm_storage_account" "this" {
  name                     = var.name
  resource_group_name      = azurerm_resource_group.this.name
  location                 = var.location
  account_tier            = var.account_tier
  account_replication_type = var.account_replication_type
}