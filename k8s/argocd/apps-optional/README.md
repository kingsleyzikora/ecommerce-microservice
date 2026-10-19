Not synced by `root-app` (which only reads `k8s/argocd/apps/`). Move files
here out of `k8s/argocd/apps/` when you want to disable them without
deleting them - e.g. move `cert-manager.yaml` and `cluster-issuer.yaml` here
if you switch to Option A (Route 53 + ACM). See the main README's
"Option A" / "Option B" sections.
