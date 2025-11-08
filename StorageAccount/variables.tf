variable "name" {
  description = "Storage account name"
  type        = string
}

variable "location" {
  description = "Storage account location"
  type        = string
}

variable "account_tier" {
  description = "Storage account tier"
  type        = string
  default     = "Standard"
}

variable "account_replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "LRS"
}