# Micro-Service Handson

A practice-grade, end-to-end microservices demo built to exercise a realistic
AWS stack cheaply:

- **5 backend microservices** (Node.js/Express), each with its own Kubernetes
  **namespace**, **Deployment**, **Service**, **ConfigMap**, and **Ingress**.
- **Amazon EKS** cluster (Terraform), sized for free-tier-friendly practice
  (`t3.small` nodes, Spot by default, single NAT gateway).
- **Docker** images per service, pushed to **Amazon ECR**.
- **nginx-ingress-controller** as the single load balancer / router in front
  of all 5 services, using **path-based routing**: one host
  (`api.yourdomain.com`), one Ingress object per service, each matching its
  own `/api/<service>` prefix.
- **cert-manager + Let's Encrypt** for automatic, auto-renewing TLS — issued
  and terminated inside the ingress-nginx pod itself. (Route 53 + ACM is
  included too, as **Option A**, if you'd rather terminate TLS at the load
  balancer instead — see §8.)
- **Route 53** (optional) for hosting your domain's DNS, including a
  walkthrough for delegating a Namecheap-registered domain to it.
- **ArgoCD** for GitOps continuous deployment into EKS.
- **GitHub Actions** for CI (test, build, push image, bump the deploy manifest).
- **AWS Amplify Hosting** for the React frontend.

Read the whole thing once before you start — the order of operations matters
(namespaces before ArgoCD, cert-manager before the ClusterIssuer, ArgoCD
before the root Application, etc).

---

## 1. Architecture

```
                         ┌─────────────────────────┐
  Browser ──────────────▶│   AWS Amplify (React)   │
                         └──────────┬───────────────┘
                                    │ HTTPS  api.yourdomain.com
                                    ▼
                    ┌───────────────────────────────┐
                    │   nginx-ingress  (AWS NLB)      │
                    │   TLS terminated in-pod via      │
                    │   cert-manager + Let's Encrypt   │
                    └───────────────┬─────────────────┘
       ┌───────────────┬────────────┼───────────────┬────────────────┐
       ▼               ▼            ▼               ▼                ▼
 /api/users      /api/products  /api/cart     /api/orders    /api/notifications
┌───────────┐   ┌─────────────┐┌───────────┐ ┌────────────┐ ┌────────────────┐
│user-service│   │product-svc  ││cart-svc   │ │order-svc   │ │notification-svc│
│ns: user-   │   │ns: product- ││ns: cart-  │ │ns: order-  │ │ns: notification│
│  service   │   │  service    ││  service  │ │  service   │ │  -service      │
└───────────┘   └─────────────┘└─────┬─────┘ └──────┬─────┘ └────────▲────────┘
                                      │ calls product  │ calls cart   │
                                      ▼                ▼ & notif.     │
                                (product-service)  (cart-service) ────┘

EKS cluster: each box above = its own namespace / Deployment / Service.
ArgoCD (namespace: argocd) continuously syncs all of the above from this git repo.
```

Each microservice is deliberately simple (in-memory storage, no database) so
the focus stays on the **platform**: namespaces, service-to-service DNS,
path-based ingress routing, TLS, GitOps, and CI. Swapping in RDS/DynamoDB
per service later is a drop-in change to each service's `src/index.js`.

| Service | Namespace | Routes | Talks to |
|---|---|---|---|
| `user-service` | `user-service` | `/api/users/*` | — |
| `product-service` | `product-service` | `/api/products/*` | — |
| `cart-service` | `cart-service` | `/api/cart/*` | `product-service` |
| `order-service` | `order-service` | `/api/orders/*` | `cart-service`, `notification-service` |
| `notification-service` | `notification-service` | `/api/notifications/*` | — |

## 2. Repository layout

```
frontend/            React (Vite) SPA, deployed via AWS Amplify
services/            5 Node.js/Express microservices + Dockerfiles + tests
infra/terraform/     VPC + EKS + ECR + GitHub OIDC role + Route 53 (+ optional ACM)
k8s/
  namespaces/        All 8 namespaces (5 services + ingress-nginx + cert-manager + argocd)
  <service>/         deployment.yaml, service.yaml, configmap.yaml, ingress.yaml per service
  ingress-nginx/      values.yaml (default: cert-manager) and values-acm.yaml (Option A)
  cert-manager/       ClusterIssuers (staging + prod)
  argocd-server-ingress/  (Optional, §5.10) Ingress exposing the ArgoCD UI on its own subdomain
  argocd/
    apps/              Auto-synced by root-app: ingress-nginx, cert-manager, cluster-issuer, 5 services (+ argocd-server-ingress if §5.10 is set up)
    apps-optional/      Not auto-synced - park files here to disable them (used by Option A)
    root-app.yaml       The one Application you kubectl apply by hand (app-of-apps)
.github/workflows/   ci-backend.yml (matrix build/test/push/deploy), ci-frontend.yml (lint/build)
```

## 3. Cost reality check (read this before you deploy)

You asked for the cheapest practical setup. Here's what is and isn't free:

| Item | Cost | Free tier? |
|---|---|---|
| EKS control plane | **~$0.10/hr (~$73/mo)** | **No** — EKS control plane is never free-tier eligible, regardless of instance type |
| EC2 worker nodes (`t3.small` x2) | ~$0.0208/hr each On-Demand, far less on Spot | `t2.micro`/`t3.micro` get 750 free hrs/mo for 12 months, but are too small to run EKS system pods reliably — see note below |
| NLB for nginx-ingress | ~$0.0225/hr + per-GB processed | No |
| ECR storage | ~$0.10/GB/month | 500MB/mo free for 12 months |
| Amplify Hosting | Build minutes + GB served | 1000 build min/mo + 15GB served free for 12 months |
| Route 53 hosted zone (if used) | $0.50/month per zone | No, but trivial |
| Route 53 DNS queries | $0.40 per million | First 1M queries/month free |
| Let's Encrypt certificates (default) | **$0** | Always free, unlimited renewals |
| Data transfer | Varies | Some free tier allowance |

**Bottom line: the EKS control plane bills ~$73/month no matter how small
your nodes are.** There is no way around this while using EKS — it is not
part of the AWS Free Tier. If you only want to avoid bills entirely, use a
single `t3.micro`/`t2.micro` EC2 instance running `k3s` or `minikube`
instead of EKS. Since you explicitly asked for **EKS**, this repo is built
for EKS and tries to minimize everything else:

- `t3.small` nodes (the practical minimum — `t2.micro`/`t3.micro` have only
  1GB RAM, and after `kube-proxy`, the VPC CNI, and CoreDNS reserve their
  share, there often isn't enough left to schedule workload pods; EKS AMIs
  also frequently fail to even join the cluster on `*.micro` sizes). If you
  want to try `t3.micro` anyway, change `node_instance_types` in
  `infra/terraform/variables.tf` — it's a one-line change.
- Spot capacity by default (`use_spot = true`) — typically 60-70% cheaper
  than On-Demand.
- 1 NAT gateway instead of 1-per-AZ (`single_nat_gateway = true`).
- Tiny per-pod resource requests (25m CPU / 64Mi memory) so 2 small nodes
  comfortably run all 5 services plus ingress-nginx, cert-manager, and
  ArgoCD.
- A single ingress-controller replica (no HA) and 1 replica per microservice.

**Destroy the cluster (`terraform destroy`) whenever you're not actively
practicing with it** — that's the only real way to keep this cheap.

## 4. Prerequisites

- An AWS account (with free tier credits) and the AWS CLI configured
  (`aws configure` or `aws sso login`).
- A domain name you control (for TLS). You mentioned one registered at
  Namecheap — §5.2a shows how to optionally delegate its DNS to Route 53 for
  centralized management, though it's not required: cert-manager's HTTP-01
  challenge works fine with Namecheap's own DNS too. You don't strictly
  need a domain just to practice — see §8 for the no-domain, plain HTTP
  shortcut.
- Installed locally: `terraform` (>=1.6), `kubectl`, `eksctl` (optional,
  Terraform is primary), `helm`, `git`, `node`/`npm` (for local dev), Docker.
- A GitHub account/repo to push this code to (needed for GitHub Actions and
  for ArgoCD to pull from).

## 5. Step-by-step deployment

### 5.1 Push this repo to GitHub

```bash
cd micro-service-handson
git init
git add .
git commit -m "Initial commit: microservices platform on EKS"
git branch -M main
git remote add origin https://github.com/<your-gh-org>/micro-service-handson.git
git push -u origin main
```

Then replace every `REPLACE_WITH_YOUR_GH_ORG` placeholder (in
`k8s/argocd/root-app.yaml`, `k8s/argocd/apps/*.yaml`, and
`infra/terraform/terraform.tfvars`) with `<your-gh-org>/micro-service-handson`,
commit, and push again.

### 5.2 Provision AWS infrastructure with Terraform

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars: region, github_repo, domain_name, instance sizes, etc.

terraform init
terraform plan   # review: 1 VPC, 1 EKS cluster, 1 managed node group, 5 ECR repos, 1 OIDC role, (optional) 1 Route 53 zone
terraform apply
```

This takes ~12-15 minutes (EKS control plane provisioning is slow). When done:

```bash
terraform output configure_kubectl   # prints the exact `aws eks update-kubeconfig` command
$(terraform output -raw configure_kubectl)
kubectl get nodes                    # should show 2 Ready t3.small nodes
```

Grab the outputs you'll need shortly:

```bash
terraform output ecr_repository_urls      # 5 repo URLs
terraform output github_actions_role_arn  # for GitHub Actions secrets
terraform output route53_zone_id          # if domain_name was set - for §5.7
```

#### 5.2a (Optional) Delegate your Namecheap domain to Route 53

This is how "manage my domain from Namecheap via Route 53" works. It's
**optional** on the default cert-manager path (HTTP-01 validation doesn't
care who hosts your DNS) — do this if you just want one place to manage all
your DNS records going forward. Namecheap stays the domain **registrar**
(you keep paying them for the registration and it still shows up in your
Namecheap account); Route 53 becomes the **DNS host** — the thing that
actually answers "where does api.yourdomain.com point?". You only do this
once per domain.

1. With `domain_name` set in `terraform.tfvars`, the `apply` above already
   created the hosted zone. Grab its nameservers:
   ```bash
   terraform output route53_name_servers
   ```
2. Log into **Namecheap** → **Domain List** → find your domain → **Manage**.
3. Scroll to **Nameservers** → change the dropdown from *Namecheap BasicDNS*
   to **Custom DNS**.
4. Paste the 4 AWS nameservers, one per field (add fields if you need more
   than 2; strip any trailing dot) → click the green checkmark to save.
5. Wait for propagation — usually 15-60 minutes, occasionally up to 24-48h.
   Check with:
   ```bash
   dig NS yourdomain.com +short
   # should eventually list the same 4 ns-xxxx.awsdns-xx.{com,net,org,co.uk} values
   ```

**Important:** once you switch to Custom DNS, Namecheap's own "Advanced DNS"
tab stops being authoritative for this domain — any records you need (the
`api` subdomain in §5.7, an `MX` record for email, etc.) must be created in
**Route 53** from now on, not in Namecheap. If you use this domain for email
or anything else today, recreate those same records in the Route 53 hosted
zone before or right after switching nameservers, so you don't drop
mail/other traffic during the cutover.

**Don't want to migrate DNS at all?** Skip this subsection entirely, leave
`domain_name = ""` in `terraform.tfvars`, and in §5.7 just add the `api`
record directly in Namecheap's own Advanced DNS instead of Route 53 — the
rest of the deployment is identical either way.

### 5.3 Configure GitHub Actions

In your GitHub repo settings → **Secrets and variables → Actions → Variables**,
add:

- `AWS_CI_ROLE_ARN` = the `github_actions_role_arn` output above
- `AWS_REGION` = your region (e.g. `us-east-1`)

No AWS access keys are stored in GitHub — the workflow assumes the IAM role
via OIDC (`infra/terraform/github_oidc.tf` already wired the trust policy to
your exact repo).

### 5.4 Create the namespaces

```bash
kubectl apply -f k8s/namespaces/namespaces.yaml
```

### 5.5 Install ArgoCD

```bash
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# --server-side is required here: the applicationsets.argoproj.io CRD is
# large enough that plain `kubectl apply` fails with
# "metadata.annotations: Too long: may not be more than 262144 bytes"
# (it tries to stash the whole manifest in an annotation for 3-way merges;
# server-side apply doesn't use that mechanism). --force-conflicts lets it
# take ownership cleanly on a retry if you've already run this once without it.
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml --server-side --force-conflicts

kubectl -n argocd rollout status deploy/argocd-server

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo

# Access the UI (simplest for practice: port-forward)
kubectl -n argocd port-forward svc/argocd-server 8080:443
# open https://localhost:8080  (user: admin, password: from above)
```

### 5.6 Bootstrap GitOps with the ArgoCD app-of-apps

Before applying anything, fill in the placeholders in git:

- Each `k8s/<service>/deployment.yaml` — replace
  `ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com` with your real ECR registry (from
  `terraform output ecr_repository_urls`), or just let the first CI run do it
  for you (see §5.8).
- Each `k8s/<service>/ingress.yaml`'s `host:` and `tls.hosts:` — replace
  `api.yourdomain.com` with your real `api.<domain_name>`.
- `k8s/cert-manager/cluster-issuer.yaml` — replace
  `REPLACE_WITH_YOUR_EMAIL@example.com` with a real email (Let's Encrypt
  uses it for expiry notices).

Commit and push those changes, then tell ArgoCD to manage *everything else*
— ingress-nginx, cert-manager, the ClusterIssuer, and all 5 microservices —
straight from git:

```bash
kubectl apply -f k8s/argocd/root-app.yaml
```

Watch it sync in the UI, or:

```bash
kubectl -n argocd get applications
```

You should see `root-app`, `ingress-nginx`, `cert-manager`, `cluster-issuer`,
and the 5 service apps all reach `Synced`/`Healthy`. Sync waves
(`argocd.argoproj.io/sync-wave` annotations) make `ingress-nginx` and
`cert-manager` install first, then `cluster-issuer`, then the microservices —
but on a brand-new cluster the `cluster-issuer` app can occasionally race
cert-manager's CRD registration on the very first sync. If it shows an error
about an unrecognized `ClusterIssuer` kind, just hit **Sync** again in the
UI a minute later.

### 5.7 Point DNS at the ingress load balancer

```bash
kubectl -n ingress-nginx get svc ingress-nginx-controller
# copy the EXTERNAL-IP (an NLB hostname, something like xxx.elb.us-east-1.amazonaws.com)
```

Create a **CNAME** for `api.yourdomain.com` pointing at that NLB hostname —
in **Route 53** if you delegated DNS there in §5.2a:

```bash
ZONE_ID=$(cd infra/terraform && terraform output -raw route53_zone_id)
NLB_HOSTNAME="<paste the EXTERNAL-IP from above>"

aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.yourdomain.com",
      "Type": "CNAME",
      "TTL": 60,
      "ResourceRecords": [{"Value": "'"$NLB_HOSTNAME"'"}]
    }
  }]
}'
```

...or in **Namecheap's Advanced DNS** instead if you skipped the delegation
— add a CNAME record there with the same host/value, no AWS CLI needed.

Give DNS a few minutes to propagate, then check cert-manager issued real
certificates (it uses HTTP-01, so this only starts succeeding once the
`api` record actually resolves to the NLB):

```bash
dig api.yourdomain.com +short
kubectl get certificate -A
kubectl describe certificaterequest -A   # if something is stuck
```

If you don't own a domain and just want to practice without TLS, see §8.

### 5.8 Build and ship the backend images (first CI run)

Push any trivial change under `services/` (or just re-push main) to trigger
`.github/workflows/ci-backend.yml`. It will, for each of the 5 services:
install deps, run tests, build the Docker image, push it to ECR, then commit
the new image tag into `k8s/<service>/deployment.yaml` — which ArgoCD
auto-syncs within ~3 minutes (or immediately if you hit **Refresh** in the UI).

```bash
kubectl -n user-service get pods
kubectl -n user-service logs deploy/user-service
```

Repeat for the other 4 namespaces to confirm all pods are `Running` and
`READY 1/1`.

### 5.9 Deploy the frontend to AWS Amplify

1. AWS Console → **Amplify Hosting** → **New app → Host web app** → connect
   your GitHub repo and branch (`main`).
2. Amplify auto-detects the monorepo build spec from the repo-root
   `amplify.yml` (its `appRoot: frontend` tells Amplify where the actual app
   lives). This only works from the repo root — if this file is nested
   inside `frontend/` instead, Amplify silently falls back to a generic
   build spec, which typically deploys something broken (404 at the app
   URL). If Amplify still doesn't pick it up, set the **app root** to
   `frontend` manually in the build settings.
3. Under **App settings → Environment variables**, add:
   - `VITE_API_BASE_URL` = `https://api.yourdomain.com`
4. Save and deploy. Amplify will rebuild automatically on every push to
   `main` from here on (this is Amplify's own CI/CD, independent of GitHub
   Actions — `.github/workflows/ci-frontend.yml` is just a lint/build gate
   on PRs).

Open the Amplify-provided URL, register a user, browse products, add to
cart, and check out — you should see a confirmed order and a notification,
proving all 5 backend services and the ingress are wired correctly.

### 5.10 (Optional) Expose the ArgoCD UI on its own subdomain

By default you only reach ArgoCD via `kubectl port-forward`, which is fine
for occasional use but annoying if you check it often. This puts it behind
a real hostname (`argo.yourdomain.com`) with a trusted cert, reusing the
exact same nginx-ingress + cert-manager pattern as the 5 microservices —
and it stays GitOps-managed afterward, just like everything else.

**1. Put `argocd-server` into insecure mode.** By default it terminates its
own self-signed TLS on port 8080; if you put an Ingress in front of that
as-is, you get TLS wrapped inside TLS, which doesn't work cleanly. Telling
it to serve plain HTTP instead lets nginx-ingress be the one terminating
real TLS, exactly like it already does for your services:

```bash
kubectl -n argocd patch configmap argocd-cmd-params-cm --type merge \
  -p '{"data":{"server.insecure":"true"}}'
kubectl -n argocd rollout restart deployment argocd-server
kubectl -n argocd rollout status deployment argocd-server
```

This is a one-time **imperative** step, not tracked in this repo's git —
because ArgoCD itself was installed straight from the upstream
`install.yaml` URL in §5.5, not from a manifest this repo owns. If you ever
reinstall ArgoCD from scratch, redo this step too.

**2. Add the Ingress**, in its own directory so its ArgoCD Application
doesn't also recurse into `k8s/argocd/`'s `root-app.yaml` and `apps/`
folder:

```bash
mkdir -p k8s/argocd-server-ingress
```

`k8s/argocd-server-ingress/ingress.yaml`:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server
  namespace: argocd
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - argo.yourdomain.com
      secretName: argocd-server-tls
  rules:
    - host: argo.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: argocd-server
                port:
                  name: http
```

Note `port: { name: http }` rather than a port number — `argocd-server`'s
Service exposes ports named `http` (80) and `https` (443), both pointing
at the same container port 8080; using the name is just clearer about
intent than guessing which number is right.

**3. Add the ArgoCD Application** so this Ingress is managed via GitOps
from here on, same as everything else:

`k8s/argocd/apps/argocd-server-ingress.yaml`:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "2"
spec:
  project: default
  source:
    repoURL: https://github.com/<your-gh-org>/<your-repo>.git
    targetRevision: main
    path: k8s/argocd-server-ingress
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

**4. Commit and push both files.** ArgoCD polls git every ~3 minutes by
default; to skip the wait, force an immediate refresh on `root-app`:

```bash
kubectl -n argocd annotate application root-app argocd.argoproj.io/refresh=hard --overwrite
```

Check it picked up the new child Application:
```bash
kubectl -n argocd get applications argocd-server-ingress
```

**5. Point DNS at the same NLB** you already created a record for in §5.7
— no new load balancer needed, nginx-ingress routes by hostname:

```bash
NLB=$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
ZONE_ID=$(cd infra/terraform && terraform output -raw route53_zone_id)

aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "argo.yourdomain.com",
      "Type": "CNAME",
      "TTL": 60,
      "ResourceRecords": [{"Value": "'"$NLB"'"}]
    }
  }]
}'
```

(No Route 53? Add the same CNAME in your DNS provider's console instead —
nginx-ingress doesn't care who hosts the zone.)

**6. Wait for the certificate, then verify:**

```bash
kubectl get certificate argocd-server-tls -n argocd --watch
```

Once `READY` shows `True`:
```bash
curl -v https://argo.yourdomain.com/
```

If it stays stuck (same symptom as §10's cert troubleshooting — HTTP-01
challenge validated but the Order never finalizes), delete the Order to
force a clean retry:
```bash
kubectl get order -n argocd
kubectl delete order <name> -n argocd
```

**7. Log in** at `https://argo.yourdomain.com` with `admin` and the
password from §5.5 (`kubectl -n argocd get secret
argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`).

## 6. Local development (no AWS needed)

Run everything on your laptop before touching the cloud:

```bash
# backend - open 5 terminals, or use a process manager of your choice
cd services/user-service && PORT=8081 npm install && npm start
cd services/product-service && PORT=8082 npm install && npm start
cd services/cart-service && PORT=8083 PRODUCT_SERVICE_URL=http://localhost:8082 npm install && npm start
cd services/notification-service && PORT=8084 npm install && npm start
cd services/order-service && PORT=8085 CART_SERVICE_URL=http://localhost:8083 NOTIFICATION_SERVICE_URL=http://localhost:8084 npm install && npm start

# frontend
cd frontend && npm install
VITE_API_BASE_URL=http://localhost:8081 npm run dev   # then wire api.js base per-route if testing manually, or run behind a local proxy
```

Each service also has a smoke test: `cd services/<name> && npm test`.

## 7. How the pieces fit together (the "why")

- **Namespace-per-service** gives each microservice its own RBAC boundary,
  resource quota potential, and blast radius — the standard "one team, one
  namespace" pattern, scaled down to "one service, one namespace" for this
  demo.
- **ClusterIP Services + DNS**, not hardcoded IPs: `cart-service` reaches
  `product-service` at `http://product-service.product-service.svc.cluster.local:8080`
  — the `<service>.<namespace>.svc.cluster.local` pattern works across
  namespaces without any service mesh.
- **Path-based routing via one Ingress object per namespace, same host** —
  nginx-ingress-controller merges Ingress resources from every namespace
  that share a host into one routing table, so you get one external
  endpoint (`api.yourdomain.com`) with each service owning a distinct path
  prefix (`/api/users`, `/api/products`, ...) — without one giant
  cross-namespace Ingress (which Kubernetes doesn't allow — an Ingress can
  only reference Services in its own namespace). The tradeoff: cert-manager
  issues one TLS secret per namespace for the same hostname (5 certs, same
  domain) — slightly redundant, fully valid, and simpler than the
  alternatives for a learning setup.
- **TLS terminates inside the ingress-nginx pod**: cert-manager watches each
  Ingress's `cert-manager.io/cluster-issuer` annotation, requests a
  certificate from Let's Encrypt via the `ClusterIssuer`, proves domain
  ownership with an HTTP-01 challenge (a temporary path cert-manager serves
  through the same ingress), and stores the result in the `tls.secretName`
  Secret — then auto-renews it well before the 90-day expiry. This gives
  you real end-to-end encryption into the pod, not just to the edge of your
  VPC. The NLB in front is a plain TCP passthrough; it never touches TLS at
  all. If you'd rather terminate at the load balancer using an AWS-managed
  certificate instead (simpler, zero renewal logic to think about, but only
  encrypted as far as the NLB), that's Option A — see §8.
- **GitOps via ArgoCD app-of-apps**: `root-app.yaml` is the only thing you
  ever `kubectl apply` by hand. Everything else — ingress-nginx,
  cert-manager, the ClusterIssuer, all 5 services — is declared as an
  ArgoCD `Application` in `k8s/argocd/apps/`, so the git repo is the single
  source of truth and `selfHeal: true` means manual `kubectl edit` drift
  gets reverted automatically.
- **CI builds images, GitOps deploys them**: GitHub Actions never touches
  the cluster directly (no kubeconfig secret to leak). It pushes to ECR and
  commits an image-tag bump to git; ArgoCD, which already has cluster
  access, picks up that commit and reconciles. This is the standard
  separation between CI (build) and CD (deploy).
- **OIDC over access keys**: the GitHub Actions workflow assumes an IAM role
  via GitHub's OIDC token, scoped to exactly this repo and exactly ECR
  push/pull — no static `AWS_ACCESS_KEY_ID` sitting in GitHub secrets.

## 8. Alternatives to the default cert-manager path

### 8.1 Practicing without a domain at all (skip TLS)

If you don't want to buy/configure a domain just to practice:

1. Remove the `tls:` block and the `cert-manager.io/cluster-issuer`
   annotation from each `k8s/<service>/ingress.yaml`.
2. Set each ingress `host` to the NLB's own hostname, or omit `host`
   entirely to match any hostname.
3. Move `k8s/argocd/apps/cert-manager.yaml` and `cluster-issuer.yaml` into
   `k8s/argocd/apps-optional/` so they're not synced.
4. Leave `domain_name = ""` in `terraform.tfvars`.
5. Hit the API over plain HTTP via the NLB hostname.

This is not how you'd run anything real, but it removes the DNS dependency
entirely for a first pass.

### 8.2 Option A: Route 53 + ACM instead of cert-manager

ACM certificates can't be exported into a pod (AWS never gives you the
private key), so this mode terminates TLS at the **NLB** instead of inside
ingress-nginx — attaching an AWS-managed certificate directly to the load
balancer. Use this if you'd rather have zero-maintenance, AWS-native
certificate renewal and don't need encryption all the way into the pod.

1. In `terraform.tfvars`, set `domain_name` (required — ACM needs a Route 53
   zone to DNS-validate against) and `request_acm_certificate = true`.
2. Create the hosted zone in its own narrow apply first, so you can delegate
   Namecheap's nameservers *before* Terraform waits on DNS validation
   (`aws_acm_certificate_validation` blocks until Route 53 is actually
   authoritative for the domain):
   ```bash
   terraform apply -target=aws_route53_zone.this
   terraform output route53_name_servers
   # go do §5.2a now, wait for propagation, then:
   terraform apply
   terraform output acm_certificate_arn
   ```
3. In `k8s/ingress-nginx/values-acm.yaml`, replace
   `REPLACE_WITH_ACM_CERTIFICATE_ARN` with that ARN.
4. Point `k8s/argocd/apps/ingress-nginx.yaml`'s `valueFiles` at
   `k8s/ingress-nginx/values-acm.yaml` instead of `values.yaml`.
5. Move `cert-manager.yaml` and `cluster-issuer.yaml` out of
   `k8s/argocd/apps/` into `k8s/argocd/apps-optional/` — ACM replaces them,
   no need to run cert-manager at all.
6. On each `k8s/<service>/ingress.yaml`, remove the `tls:` block and the
   `cert-manager.io/cluster-issuer` annotation — TLS is now the NLB's job.
7. Commit, push, apply `root-app.yaml`, then create the `api` CNAME as in
   §5.7 (pointing at the NLB) — no certificate wait this time, since ACM
   already validated and issued it back in step 2.

Everything else in this repo (the 5 microservices, ArgoCD, CI) is identical
regardless of which TLS option you pick.

## 9. Tearing down (do this when you're done practicing)

Order matters — delete ArgoCD-managed resources first so they don't fight
Terraform, then destroy the infrastructure:

```bash
kubectl delete -f k8s/argocd/root-app.yaml   # cascades: deletes all child Applications and their resources
kubectl -n argocd delete -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl delete namespace argocd

cd infra/terraform
terraform destroy
```

Double-check in the AWS console that the NLB, NAT gateway, and EKS cluster
are actually gone — orphaned load balancers are the most common source of
surprise bills on a torn-down-but-not-really cluster.

**If you delegated your domain to Route 53** (§5.2a), `terraform destroy`
deletes that hosted zone too. Your domain's nameservers at Namecheap will
still point at it afterward — meaning the domain stops resolving entirely
until you either recreate the zone or switch Namecheap's nameservers back
to *Namecheap BasicDNS* (Namecheap → Domain List → Manage → Nameservers).
Do one of those before walking away if the domain matters to you outside
this project.

## 10. Troubleshooting

- **`ClusterIssuer` stuck / "no matches for kind"**: cert-manager's CRDs
  hadn't finished registering before ArgoCD tried to apply the issuer. Hit
  Sync again on the `cluster-issuer` app.
- **Certificate stuck in `False` / HTTP01 challenge failing**: your DNS
  record isn't resolving to the ingress NLB yet, or propagation hasn't
  finished. `dig api.yourdomain.com` to confirm, then re-check
  `kubectl describe challenge -A`.
- **Site unreachable right after switching Namecheap to Custom DNS**: normal
  — propagation can take anywhere from 15 minutes to 48 hours. `dig NS
  yourdomain.com +short` to check progress.
- **Pods `Pending` with "Insufficient cpu/memory"**: your nodes are too
  small for the scheduled pods. Bump `node_instance_types` to `t3.medium` or
  increase `node_desired_size` in `infra/terraform/variables.tf`, then
  `terraform apply`.
- **(Option A only) `terraform apply` hangs on
  `aws_acm_certificate_validation`**: your domain's nameservers aren't
  actually pointed at Route 53 yet. This is why §8.2 has you do the hosted
  zone in its own `-target` apply first — confirm with
  `dig NS yourdomain.com +short` before re-running the full apply.
- **GitHub Actions "AccessDenied" assuming the role**: confirm the
  `AWS_CI_ROLE_ARN`/`AWS_REGION` repo *variables* (not secrets) are set, and
  that `github_repo` in `terraform.tfvars` exactly matches `org/repo`.
- **Amplify build fails on `npm ci`**: make sure `frontend/package-lock.json`
  is committed — it's not in `.gitignore`, only `node_modules/` is.
