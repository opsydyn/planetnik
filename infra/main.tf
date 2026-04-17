terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

locals {
  runtime_app_name = "${var.project_name}-runtime"
  hosted_app_name  = "${var.project_name}-app"
  runtime_url      = "https://${local.runtime_app_name}.${azurerm_container_app_environment.main.default_domain}"
  hosted_app_url   = "https://${local.hosted_app_name}.${azurerm_container_app_environment.main.default_domain}"
  cookie_domain    = ".${azurerm_container_app_environment.main.default_domain}"
  common_tags      = merge(var.tags, { project = var.project_name })
}

resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = var.log_retention_days
  tags                = local.common_tags
}

resource "azurerm_container_registry" "main" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.common_tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.project_name}-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.common_tags
}

resource "azurerm_container_app" "runtime" {
  name                         = local.runtime_app_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.common_tags

  secret {
    name  = "registry-password"
    value = azurerm_container_registry.main.admin_password
  }

  secret {
    name  = "database-url"
    value = var.database_url
  }

  secret {
    name  = "better-auth-secret"
    value = var.better_auth_secret
  }

  dynamic "secret" {
    for_each = var.openai_api_key == null || var.openai_api_key == "" ? [] : [var.openai_api_key]
    content {
      name  = "openai-api-key"
      value = secret.value
    }
  }

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "registry-password"
  }

  ingress {
    external_enabled = true
    target_port      = 1337
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = var.runtime_min_replicas
    max_replicas = var.runtime_max_replicas

    container {
      name   = "runtime"
      image  = "mcr.microsoft.com/k8se/quickstart:latest"
      cpu    = var.runtime_cpu
      memory = var.runtime_memory

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "1337"
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "BETTER_AUTH_SECRET"
        secret_name = "better-auth-secret"
      }

      env {
        name  = "BETTER_AUTH_URL"
        value = local.runtime_url
      }

      env {
        name  = "CORS_ORIGIN"
        value = local.hosted_app_url
      }

      env {
        name  = "AUTH_COOKIE_SECURE"
        value = "true"
      }

      env {
        name  = "AUTH_COOKIE_SAME_SITE"
        value = "lax"
      }

      env {
        name  = "COOKIE_DOMAIN"
        value = local.cookie_domain
      }

      env {
        name  = "COPILOT_MODEL"
        value = var.copilot_model
      }

      dynamic "env" {
        for_each = var.openai_api_key == null || var.openai_api_key == "" ? [] : [var.openai_api_key]
        content {
          name        = "OPENAI_API_KEY"
          secret_name = "openai-api-key"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].container[0].image]
  }
}

resource "azurerm_container_app" "hosted_app" {
  name                         = local.hosted_app_name
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.common_tags

  secret {
    name  = "registry-password"
    value = azurerm_container_registry.main.admin_password
  }

  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "registry-password"
  }

  ingress {
    external_enabled = true
    target_port      = 4321
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = var.app_min_replicas
    max_replicas = var.app_max_replicas

    container {
      name   = "app"
      image  = "mcr.microsoft.com/k8se/quickstart:latest"
      cpu    = var.app_cpu
      memory = var.app_memory

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "PORT"
        value = "4321"
      }

      env {
        name  = "PUBLIC_SERVER_URL"
        value = local.runtime_url
      }

      env {
        name  = "PUBLIC_COPILOT_RUNTIME_URL"
        value = "${local.runtime_url}/api/copilotkit"
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].container[0].image]
  }
}
