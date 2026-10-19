variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "micro-service-handson"
}

variable "cluster_version" {
  description = "Kubernetes version for EKS control plane"
  type        = string
  default     = "1.30"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_instance_types" {
  description = "Cheap burstable instance types for the worker node group. t3.small is the practical minimum for EKS (t2/t3.micro is too small once kubelet, kube-proxy, CNI and VPC CNI pods are scheduled)."
  type        = list(string)
  default     = ["t3.small"]
}

variable "node_desired_size" {
  description = "Desired worker node count"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum worker node count"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum worker node count"
  type        = number
  default     = 3
}

variable "use_spot" {
  description = "Use Spot capacity for worker nodes to cut cost further (can be interrupted; fine for practice, not for anything you need to stay up)"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use one shared NAT gateway instead of one per AZ to save ~$32/month per extra NAT gateway"
  type        = bool
  default     = true
}
