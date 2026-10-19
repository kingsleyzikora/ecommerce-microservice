terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Uncomment and configure to keep state off your laptop once you have an
  # S3 bucket + DynamoDB lock table (see README "Remote state" section).
  # backend "s3" {
  #   bucket         = "REPLACE_WITH_YOUR_TF_STATE_BUCKET"
  #   key            = "micro-service-handson/eks/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "REPLACE_WITH_YOUR_TF_LOCK_TABLE"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
