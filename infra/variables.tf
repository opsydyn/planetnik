variable "subscription_id" {
  description = "Azure subscription ID."
  type        = string
}

variable "project_name" {
  description = "Project name used as a prefix for Azure resources."
  type        = string
  default     = "planetnik"
}

variable "resource_group_name" {
  description = "Azure resource group for hosted Planetnik."
  type        = string
  default     = "planetnik-rg"
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "uksouth"
}

variable "tags" {
  description = "Tags applied to managed resources."
  type        = map(string)
  default = {
    managed_by = "terraform"
    workload   = "hosted-intelligence"
  }
}

variable "acr_name" {
  description = "Globally unique Azure Container Registry name. Alphanumeric only."
  type        = string
}

variable "datasets_storage_account_name" {
  description = "Optional globally unique Azure Storage Account name for hosted datasets. Defaults to a value derived from acr_name."
  type        = string
  default     = null
}

variable "datasets_share_name" {
  description = "Azure Files share name mounted into planetnik-runtime for named datasets."
  type        = string
  default     = "datasets"
}

variable "datasets_share_quota_gb" {
  description = "Quota in GiB for the hosted datasets Azure Files share."
  type        = number
  default     = 100
}

variable "database_url" {
  description = "External Postgres connection string, for example Neon."
  type        = string
  sensitive   = true
}

variable "better_auth_secret" {
  description = "Better Auth secret. Generate with: openssl rand -base64 32"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "Optional OpenAI API key used by /api/copilotkit."
  type        = string
  default     = null
  sensitive   = true
}

variable "copilot_model" {
  description = "OpenAI model used by the hosted CopilotKit runtime."
  type        = string
  default     = "gpt-4o"
}

variable "log_retention_days" {
  description = "Log Analytics retention in days."
  type        = number
  default     = 30
}

variable "runtime_min_replicas" {
  description = "Minimum runtime replicas."
  type        = number
  default     = 0
}

variable "runtime_max_replicas" {
  description = "Maximum runtime replicas."
  type        = number
  default     = 1
}

variable "runtime_cpu" {
  description = "Runtime Container App CPU cores."
  type        = number
  default     = 0.5
}

variable "runtime_memory" {
  description = "Runtime Container App memory."
  type        = string
  default     = "1Gi"
}

variable "app_min_replicas" {
  description = "Minimum hosted app replicas."
  type        = number
  default     = 0
}

variable "app_max_replicas" {
  description = "Maximum hosted app replicas."
  type        = number
  default     = 1
}

variable "app_cpu" {
  description = "Hosted app Container App CPU cores."
  type        = number
  default     = 0.25
}

variable "app_memory" {
  description = "Hosted app Container App memory."
  type        = string
  default     = "0.5Gi"
}

variable "app_show_intelligence" {
  description = "Whether the hosted app exposes the intelligence page and side panel."
  type        = bool
  default     = true
}
