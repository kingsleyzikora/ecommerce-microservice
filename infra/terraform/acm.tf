# OPTIONAL: an auto-renewing ACM certificate, DNS-validated in the Route 53
# zone from route53.tf. This repo's default TLS path is cert-manager + Let's
# Encrypt (see README), which needs none of this - it issues its own
# certificate independently of AWS. Only turn this on if you switch to
# Option A (TLS terminated at the NLB using ACM instead of cert-manager).
#
# Requires domain_name to be set (route53.tf) AND the zone to already be
# delegated/authoritative in Route 53 - otherwise this resource will hang
# waiting for DNS validation. See README "Option A".

variable "request_acm_certificate" {
  description = "Request and DNS-validate an ACM certificate for api_fqdn. Only needed for Option A (Route 53 + ACM); leave false for the default cert-manager + Let's Encrypt path."
  type        = bool
  default     = false
}

locals {
  use_acm = local.use_route53 && var.request_acm_certificate
}

resource "aws_acm_certificate" "api" {
  count             = local.use_acm ? 1 : 0
  domain_name       = local.api_fqdn
  validation_method = "DNS"

  tags = {
    Project = var.cluster_name
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = local.use_acm ? {
    for dvo in aws_acm_certificate.api[0].domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  } : {}

  zone_id = local.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.value]
  ttl     = 60

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "api" {
  count                   = local.use_acm ? 1 : 0
  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}
