# Workout Builder

A local calendar tracker for any dumbbell-style training program. Reads the program from `/program.yaml` at boot, so you can configure it via a Kubernetes ConfigMap without rebuilding the image. Comes shipped with the [Son Goku 60-day dumbbell program](https://www.midasmvmt.com/workouts/son-goku) as the default.

Features:
- Calendar view with workout name + category on every cell
- Movable start date — shifts the whole program
- Mark extra rest days (pushes the schedule forward)
- Per-browser progress persisted in `localStorage`
- Material 3-style dark UI

Built with **Vite + React + Tailwind**. State is browser-local; the program definition is server-side YAML.

## Program YAML format

Each entry in `days` is either a rest marker or a workout. Example:

```yaml
name: Son Goku
subtitle: 60-day dumbbell program

days:
  - { workout: Upper Body, video: z1NlYriM0Uk }   # YouTube ID (the part after youtu.be/)
  - { workout: Lower Body, video: rXfkO9vfA4Y }
  - rest                                          # a scheduled rest day
  - { workout: Legs,       video: 7dEkOdcE6Vw }
```

`name` and `subtitle` appear in the top bar. `days` becomes the program in order.

The bundled default lives at `public/program.yaml` and is baked into the image. In Kubernetes, mount a ConfigMap over it to override.

## Local dev (HMR)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — edits to `src/` hot-reload. Edits to `public/program.yaml` are picked up on browser refresh.

## Local dev in Docker (HMR)

```bash
docker compose --profile dev up --build
```

## Production build in Docker (nginx)

```bash
docker compose --profile prod up -d --build
```

Open http://localhost:8000.

## Kubernetes / k3s deployment

The image bakes a default program. To swap it without rebuilding, mount a ConfigMap over `/usr/share/nginx/html/program.yaml`.

```bash
# Build the image (or push to a registry your k3s nodes can reach)
docker build -t workout-builder:latest .
# If you're on a single-node k3s with containerd:
docker save workout-builder:latest | sudo k3s ctr images import -

# Apply the ConfigMap and Deployment
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml

# Reach it (port-forward, or uncomment the Ingress in deployment.yaml)
kubectl port-forward svc/workout-builder 8000:80
```

Open http://localhost:8000.

### Editing the program in-cluster

Edit `k8s/configmap.yaml` (or `kubectl edit configmap workout-builder-program`) and re-apply. The browser picks up the new program on next load — the app fetches `/program.yaml` with `cache: 'no-store'`, so just refresh.

For the running pod to immediately see a new ConfigMap value, kubelet typically rotates the mounted file within ~60s. To force an instant rollout:

```bash
kubectl rollout restart deployment/workout-builder
```

### Fallback behavior

If `/program.yaml` is missing or invalid, the app shows a red error banner in the top of the page and a no-op state. The `Settings` dialog displays the load source and parser error.
