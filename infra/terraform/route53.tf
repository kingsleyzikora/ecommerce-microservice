# Route 53 hosted zone for your domain - this is just DNS hosting, separate
# from certificates. Entirely optional: leave domain_name empty to skip it
# and manage DNS at Namecheap (or wherever) directly instead.
#
# If your domain is registered elsewhere (e.g. Namecheap), you still host its
# DNS in Route 53 by delegating the domain's nameservers to the 4 values in
# the route53_name_servers output - see README "Delegating Namecheap to
# Route 53" for the exact steps. Namecheap stays the registrar; Route 53
# becomes the authoritative DNS server.

variable "domain_name" {
  description = "Root domain you registered (e.g. example.com). Leave empty to skip Route 53 entirely."
  type        = string
  default     = ""
}

variable "create_hosted_zone" {
  description = "Create a new Route 53 public hosted zone for domain_name. Set to false if you already created one yourself (set hosted_zone_id below)."
  type        = bool
  default     = true
}

variable "hosted_zone_id" {
  description = "Existing Route 53 hosted zone ID to use when create_hosted_zone is false. Ignored otherwise."
  type        = string
  default     = ""
}

variable "api_subdomain" {
  description = "Subdomain the backend API will be served on, e.g. \"api\" -> api.example.com"
  type        = string
  default     = "api"
}

locals {
  use_route53 = var.domain_name != ""
  api_fqdn    = local.use_route53 ? "${var.api_subdomain}.${var.domain_name}" : ""
  zone_id = local.use_route53 ? (
    var.create_hosted_zone ? aws_route53_zone.this[0].zone_id : var.hosted_zone_id
  ) : null
}

resource "aws_route53_zone" "this" {
  count = local.use_route53 && var.create_hosted_zone ? 1 : 0
  name  = var.domain_name

  tags = {
    Project = var.cluster_name
  }
}
