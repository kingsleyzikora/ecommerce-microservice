# Lets GitHub Actions assume an AWS role via OIDC (no long-lived access keys
# stored in GitHub secrets). Scoped to just this repo and just ECR push.

variable "github_repo" {
  description = "GitHub repo allowed to assume the CI role, as org/repo"
  type        = string
  default     = "kingsleyzikora/ecommerce-microservice"
}

data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      # GitHub now embeds immutable numeric IDs alongside the org/repo names
      # in the sub claim (e.g. "repo:org@123/repo@456:ref:..." instead of
      # "repo:org/repo:ref:..."), so a repo/org rename can't be used to
      # hijack an old trust relationship. Matching with wildcards in place
      # of the optional "@<id>" segments keeps this working whether or not
      # GitHub includes them for a given repo, without hardcoding IDs that
      # would break the moment this repo (or its owner account) is renamed.
      values = [
        "repo:${var.github_repo}:*",
        "repo:${split("/", var.github_repo)[0]}@*/${split("/", var.github_repo)[1]}@*:*",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions_ci" {
  name               = "${var.cluster_name}-github-actions-ci"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
}

data "aws_iam_policy_document" "github_actions_ecr" {
  statement {
    sid       = "ECRAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [for repo in aws_ecr_repository.service : repo.arn]
  }
}

resource "aws_iam_role_policy" "github_actions_ecr" {
  name   = "ecr-push-pull"
  role   = aws_iam_role.github_actions_ci.id
  policy = data.aws_iam_policy_document.github_actions_ecr.json
}
