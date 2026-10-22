module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets

  # Public endpoint kept open for practice so kubectl/ArgoCD work from your
  # laptop without a VPN/bastion. Lock this down for anything real.
  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  enable_cluster_creator_admin_permissions = true

  cluster_addons = {
    coredns    = { most_recent = true }
    kube-proxy = { most_recent = true }

    vpc-cni = {
      most_recent = true
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
      })
    }
    eks-pod-identity-agent = { most_recent = true }
  }

  eks_managed_node_groups = {
    default = {
      # Explicit on purpose: AWS itself defaults new node groups to AL2023
      # when ami_type is omitted, but the module's *Terraform-side* user-data
      # rendering logic does NOT independently know that - left unset, it
      # silently falls back to the deprecated AL2/bootstrap.sh rendering
      # path, which ignores cloudinit_pre_nodeadm entirely (that mechanism
      # only applies to the AL2023/nodeadm path below). Setting this
      # explicitly keeps the two in sync.
      ami_type = "AL2023_x86_64_STANDARD"

      instance_types = var.node_instance_types
      capacity_type  = var.use_spot ? "SPOT" : "ON_DEMAND"

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      # t3.small ships 2GB RAM; keep the EBS root volume small too to save a
      # few cents of gp3 storage per month.
      disk_size = 20

      # t3.small's default max-pods (11, from AWS's static ENI/IP lookup
      # table) is too low to fit ArgoCD + cert-manager + ingress-nginx + all
      # 5 microservices across just 2 nodes - you run out of pod slots long
      # before you run out of CPU/memory. ENABLE_PREFIX_DELEGATION above
      # lets the CNI hand out far more IPs per node, but kubelet's own
      # --max-pods ceiling is calculated once at boot and won't pick that up
      # on its own - this NodeConfig explicitly raises it to match. Applies
      # to every node the ASG ever launches (fresh cluster, scale-out, Spot
      # replacement), so this only needs setting once, here.
      cloudinit_pre_nodeadm = [
        {
          content_type = "application/node.eks.aws"
          content      = <<-EOT
            apiVersion: node.eks.aws/v1alpha1
            kind: NodeConfig
            spec:
              kubelet:
                config:
                  maxPods: 110
          EOT
        }
      ]

      labels = {
        workload = "general"
      }
    }
  }

  tags = {
    Project = var.cluster_name
  }
}
