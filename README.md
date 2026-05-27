# 🧩 Sudoku Sally — Monorepo

Beautiful, modern **Sudoku** game (mobile) + backend + marketing site, all in one repo.

**Live site:** https://sudoku.gowithsally.com  ·  **Download APK:** [latest release](https://github.com/salistar/sudo-sally/releases/latest)

---

## 📦 Repository layout

| Folder | What | Stack |
|--------|------|-------|
| [`mobile/`](./mobile) | The Sudoku Sally app | Expo SDK 52 · React Native 0.76 · expo-router · TypeScript |
| [`backend/`](./backend) | REST API + realtime challenge server | Node.js · Express · Socket.IO · MongoDB · JWT |
| [`landing/`](./landing) | Multi-page marketing & download site | Static HTML/CSS/JS · served by nginx |
| [`deploy/`](./deploy) | Production Docker stack + Cloudflare Tunnel ingress | docker compose |
| [`.github/workflows/`](./.github/workflows) | CI/CD | GitHub Actions |

> Native folders `mobile/android` and `mobile/ios` are **not committed** — they are regenerated reproducibly by `expo prebuild` in CI.

---

## 🚀 Quick start

### Mobile (dev)
```bash
cd mobile
npm install
npx expo start --dev-client     # or: npx expo run:android
```

### Backend (dev)
```bash
cd backend
docker compose up -d            # API :3101, Mongo :27117, mongo-express :8181
```

### Landing (dev)
```bash
cd landing
python -m http.server 8080      # then open http://localhost:8080
```

---

## 🤖 CI/CD (GitHub Actions)

- **`build-apk.yml`** — on every push to `main` (and on tags / manual dispatch) it runs `expo prebuild`, signs with the registered debug keystore, builds the Android **APK**, uploads it as an artifact and (on a `v*` tag) attaches it to a GitHub **Release**.
- **`deploy.yml`** — on push to `main` touching `backend/`, `landing/` or `deploy/`, it SSHes into **server 1** (`91.99.70.43`) and runs [`deploy/deploy.sh`](./deploy/deploy.sh), which rebuilds the production stack behind the Cloudflare Tunnel.

### Required GitHub secrets
| Secret | Used by | Purpose |
|--------|---------|---------|
| `ANDROID_DEBUG_KEYSTORE_B64` | build-apk | base64 of the debug keystore whose SHA-1 is registered with Google OAuth (keeps Google sign-in working in the APK) |
| `SERVER_HOST` | deploy | `91.99.70.43` |
| `SERVER_USER` | deploy | `root` |
| `SERVER_SSH_KEY` | deploy | private key authorized on server 1 |
| `JWT_SECRET` | deploy | backend JWT signing secret |

---

## 🌐 Production architecture (server 1)

```
Cloudflare (DNS + Tunnel)  →  cloudflared  →  sudoku-landing (nginx :80)
                                                 ├── /            static site
                                                 ├── /api/        → sudoku-api :3001
                                                 └── /socket.io/  → sudoku-api :3001
                                              sudoku-api  →  sudoku-mongo
```
No public ports are opened on the VPS — everything is reached through the existing Cloudflare Tunnel. See [`deploy/`](./deploy).

---

© 2026 Sudoku Sally
