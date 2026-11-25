# Builds images, creates secrets (from the local service-account file) and applies the manifests.
# Requires a running cluster (Docker Desktop Kubernetes, kind or minikube).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$line = Get-Content "$root/.env" | Where-Object { $_ -like "FIREBASE_SA_FILE=*" }
if (-not $line) { throw "Set FIREBASE_SA_FILE in $root/.env (see .env.example)" }
$sa = Get-Item (Join-Path $root ($line -split '=', 2)[1])

kubectl cluster-info | Out-Null

docker compose --project-directory $root -f "$root/docker-compose.yml" build
if ($LASTEXITCODE) { throw "image build failed" }

# kind/minikube do not see the local Docker image store.
$ctx = kubectl config current-context
if ($ctx -like "kind-*") { kind load docker-image sprpa-backend:1.0.0 sprpa-frontend:1.0.0 --name ($ctx -replace '^kind-','') }
elseif ($ctx -eq "minikube") { minikube image load sprpa-backend:1.0.0; minikube image load sprpa-frontend:1.0.0 }

kubectl create namespace sprpa --dry-run=client -o yaml | kubectl apply -f -

kubectl -n sprpa create secret generic firebase-sa --from-file=firebase.json=$sa.FullName --dry-run=client -o yaml | kubectl apply -f -
if (-not (kubectl -n sprpa get secret db -o name 2>$null)) {
  $pw = -join ((48..57) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  kubectl -n sprpa create secret generic db --from-literal=password=$pw --from-literal="url=postgres://sprpa:$pw@postgres:5432/sprpa"
}

kubectl apply -f "$PSScriptRoot/app.yaml"
kubectl -n sprpa rollout status statefulset/postgres --timeout=180s
kubectl -n sprpa rollout status deployment/backend --timeout=180s
kubectl -n sprpa rollout status deployment/frontend --timeout=180s
Write-Host "`nReady: http://localhost:30080  (or: kubectl -n sprpa port-forward svc/frontend 8081:80)"
