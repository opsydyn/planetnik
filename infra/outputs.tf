output "hosted_app_url" {
  description = "Public URL of the hosted Astro app."
  value       = "https://${azurerm_container_app.hosted_app.ingress[0].fqdn}"
}

output "runtime_url" {
  description = "Public URL of the Elysia runtime."
  value       = "https://${azurerm_container_app.runtime.ingress[0].fqdn}"
}

output "acr_login_server" {
  description = "Azure Container Registry login server."
  value       = azurerm_container_registry.main.login_server
}

output "container_app_environment_domain" {
  description = "Default domain of the Container Apps Environment."
  value       = azurerm_container_app_environment.main.default_domain
}

output "hosted_app_name" {
  description = "Hosted app Container App name."
  value       = azurerm_container_app.hosted_app.name
}

output "runtime_app_name" {
  description = "Runtime Container App name."
  value       = azurerm_container_app.runtime.name
}
