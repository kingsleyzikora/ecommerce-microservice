output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "configure_kubectl" {
  description = "Run this to point kubectl at the new cluster"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "ecr_repository_urls" {
  value = { for name, repo in aws_ecr_repository.service : name => repo.repository_url }
}

output "github_actions_role_arn" {
  description = "Put this in the GitHub Actions workflow / repo variable AWS_CI_ROLE_ARN"
  value       = aws_iam_role.github_actions_ci.arn
}

output "route53_name_servers" {
  description = "Set these as the Custom DNS nameservers for domain_name at Namecheap (strip trailing dots). Null if domain_name is unset or you brought your own zone."
  value       = local.use_route53 && var.create_hosted_zone ? aws_route53_zone.this[0].name_servers : null
}

output "route53_zone_id" {
  description = "Hosted zone ID - needed when you create the api.<domain> record pointing at the ingress NLB after it's up"
  value       = local.use_route53 ? local.zone_id : null
}

output "acm_certificate_arn" {
  description = "Option A only (request_acm_certificate = true): paste this into k8s/ingress-nginx/values-acm.yaml's aws-load-balancer-ssl-cert annotation. Null when using the default cert-manager path."
  value       = local.use_acm ? aws_acm_certificate_validation.api[0].certificate_arn : null
}

output "api_fqdn" {
  description = "The hostname your Ingress resources and frontend VITE_API_BASE_URL should use"
  value       = local.api_fqdn != "" ? local.api_fqdn : null
}
