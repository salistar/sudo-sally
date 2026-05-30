# 🧩 Sudoku Sally — Monorepo

[![Build APK](https://github.com/salistar/sudo-sally/actions/workflows/build-apk.yml/badge.svg)](https://github.com/salistar/sudo-sally/actions/workflows/build-apk.yml)
[![Deploy](https://github.com/salistar/sudo-sally/actions/workflows/deploy.yml/badge.svg)](https://github.com/salistar/sudo-sally/actions/workflows/deploy.yml)
[![Latest release](https://img.shields.io/github/v/release/salistar/sudo-sally?display_name=tag&sort=semver)](https://github.com/salistar/sudo-sally/releases/latest)
[![Live site](https://img.shields.io/website?url=https%3A%2F%2Fsudoku.gowithsally.com&label=site&up_message=live&down_message=down)](https://sudoku.gowithsally.com)
[![API health](https://img.shields.io/website?url=https%3A%2F%2Fapi.sudoku.gowithsally.com%2Fhealth&label=API&up_message=ok)](https://api.sudoku.gowithsally.com/health)

Beautiful, modern **Sudoku** game (mobile) + realtime backend + marketing/download site — all in one repo, with full CI/CD to the cloud.

**Live site:** https://sudoku.gowithsally.com · **Web app:** https://app.sudoku.gowithsally.com · **API:** https://api.sudoku.gowithsally.com · **Download APK:** [latest release](https://github.com/salistar/sudo-sally/releases/latest)

## ⚡ TL;DR — install the APK and it just works
```
1. Tap https://sudoku.gowithsally.com/downloads/sudoku-sally.apk on your Android phone.
2. Open the downloaded file → "Install" (allow "Install unknown apps" once).
3. Open Sudoku Sally → tap idriss1 / idriss2 / idrissmobile, or register.
   Everything (chat, audio/video calls, recording, leaderboard, daily) hits
   prod api.sudoku.gowithsally.com — works on Wi-Fi AND 4G, no Metro,
   no dev server, no localhost involved.
```
The APK is a **release-signed, Hermes-bytecoded, ABI-trimmed** build (~80 MB). It is the **same artifact** you would later upload to the Google Play Console.

---

## 📦 Repository layout

| Folder | What | Stack |
|--------|------|-------|
| [`mobile/`](./mobile) | The Sudoku Sally app (Android + iOS + **Web** via react-native-web) | Expo SDK 52 · React Native 0.76 · expo-router · TypeScript |
| [`backend/`](./backend) | REST API + realtime challenge server | Node.js · Express · Socket.IO · MongoDB · JWT |
| [`landing/`](./landing) | Multi-page marketing & download site | Static HTML/CSS/JS · nginx |
| [`deploy/`](./deploy) | Production Docker stack + Caddy reverse-proxy snippet | docker compose |
| [`.github/workflows/`](./.github/workflows) | CI/CD pipelines | GitHub Actions |
| [`docs/screenshots/`](./docs/screenshots) | Mobile app screenshots | — |

> The native folders `mobile/android` and `mobile/ios` are **not committed** — they are regenerated reproducibly by `expo prebuild` in CI.

---

## 📱 Mobile screenshots

| Splash | Welcome / Language | Home | Levels |
|:---:|:---:|:---:|:---:|
| <img src="./docs/screenshots/01b-splash-animated.png" width="190"/> | <img src="./docs/screenshots/02-welcome.png" width="190"/> | <img src="./docs/screenshots/05-home.png" width="190"/> | <img src="./docs/screenshots/06-levels.png" width="190"/> |

| Game | Daily | Challenge lobby | 1v1 Challenge |
|:---:|:---:|:---:|:---:|
| <img src="./docs/screenshots/07-game.png" width="190"/> | <img src="./docs/screenshots/08-daily.png" width="190"/> | <img src="./docs/screenshots/09-challenges.png" width="190"/> | <img src="./docs/screenshots/10-challenge-game.png" width="190"/> |

| Login | Register | Profile | Stats |
|:---:|:---:|:---:|:---:|
| <img src="./docs/screenshots/03-login.png" width="190"/> | <img src="./docs/screenshots/04-register.png" width="190"/> | <img src="./docs/screenshots/12-profile.png" width="190"/> | <img src="./docs/screenshots/13-stats.png" width="190"/> |

| Leaderboard | Achievements | Shop | Settings |
|:---:|:---:|:---:|:---:|
| <img src="./docs/screenshots/14-leaderboard.png" width="190"/> | <img src="./docs/screenshots/15-achievements.png" width="190"/> | <img src="./docs/screenshots/16-shop.png" width="190"/> | <img src="./docs/screenshots/19-settings.png" width="190"/> |

| Multiplayer | How to play | Tutorial | Logout dialog |
|:---:|:---:|:---:|:---:|
| <img src="./docs/screenshots/11-multiplayer.png" width="190"/> | <img src="./docs/screenshots/17-howtoplay.png" width="190"/> | <img src="./docs/screenshots/18-tutorial.png" width="190"/> | <img src="./docs/screenshots/20-popup-logout.png" width="190"/> |

All 21 screens live in [`docs/screenshots/`](./docs/screenshots).

---

## 🗺️ Production architecture

```
                         Cloudflare DNS (zone: gowithsally.com)
        sudoku  (A → 88.198.205.229, 🟠 Proxied)
        api / db / cache .sudoku  (A → 88.198.205.229, ⚪ DNS-only)
                                   │
                                   ▼
                  Server 2 · gowithsally-prod · 88.198.205.229 (Hetzner)
                                   │
                          ┌────────┴─────────┐
                          │  gws-caddy        │  auto-HTTPS (Let's Encrypt)
                          │  :80 / :443       │  shared net: gowithsally_gws-net
                          └────────┬──────────┘
       sudoku.gowithsally.com  ───►│──► sudoku-landing (nginx :80) ── /api,/socket.io ─┐
       app.sudoku.gowithsally.com ►│──► sudoku-web (Expo Web build) ──────────────────┐│
       api.sudoku.gowithsally.com ►│──► sudoku-api (:3001) ◄───────────────────────────┴┘
       db.sudoku.gowithsally.com  ►│──► sudoku-mongo-ui (mongo-express, basic-auth)
       cache.sudoku.gowithsally.com►│─► sudoku-redis-ui (redis-commander, basic-auth)
                                    │
                       sudoku-api ──┴──► sudoku-mongo · sudoku-redis  (private net: sudoku_net)
```

Caddy already runs on the box for `gowithsally.com`; we just join its network and add site blocks. No new public ports are opened.

---

## 🔄 How everything stays in sync (single source of truth = GitHub `main`)

Every piece of the stack — mobile app, web app, landing page, backoffice (admin UIs), backend, database schema, infra config — lives in **this monorepo** and is rebuilt from `main` by CI. There is **no manual edit on the VPS** that isn't tracked here.

```
                     ┌──────────────────────────────┐
                     │  YOUR LAPTOP (localhost)     │
                     │  git push origin main / v*   │
                     └──────────────┬───────────────┘
                                    │
                                    ▼
                ┌────────────────────────────────────────┐
                │            GitHub  (main branch)        │  ← single source of truth
                └────────────────────────────────────────┘
                                    │
            ┌───────────────────────┴─────────────────────────┐
            │ Actions: build-apk.yml          Actions: deploy.yml │
            │ (mobile/** + tags)              (backend/landing/deploy/**) │
            ▼                                                   ▼
   ┌─────────────────────┐                       ┌────────────────────────────┐
   │ Signed release APK  │                       │ SSH → VPS 88.198.205.229    │
   │ • attached to       │                       │ • git pull origin main      │
   │   GitHub Release    │                       │ • write .env.prod from     │
   │ • re-staged on the  │                       │   GitHub Secrets            │
   │   landing container │                       │ • docker compose up -d --build │
   └─────────┬───────────┘                       │   (api · landing · web ·    │
             │                                   │    mongo · redis · admin UIs)│
             ▼                                   └─────────────┬───────────────┘
   sudoku.gowithsally.com/downloads/                           │
   sudoku-sally.apk                                            ▼
                                              ┌─────────────────────────────┐
                                              │ Caddy reverse-proxy + Let's │
                                              │ Encrypt → 5 public domains: │
                                              │  • sudoku.gowithsally.com    │
                                              │    (landing + APK download)  │
                                              │  • app.sudoku.gowithsally.com│
                                              │    (Expo Web build = SAME    │
                                              │     React Native code)       │
                                              │  • api.sudoku.gowithsally.com│
                                              │  • db.sudoku.gowithsally.com │
                                              │    (Mongo Express admin)    │
                                              │  • cache.sudoku.gowithsally  │
                                              │    .com (Redis Commander)    │
                                              └─────────────────────────────┘
```

### Mobile app  ↔  Web app  ↔  Backend — one codebase, three surfaces
- **`mobile/`** is a single React Native code-base. The Expo CLI exports it three ways:
  - **APK** (`gradlew assembleRelease` in CI) → users install on Android
  - **Web bundle** (`npx expo export --platform web`) → served at `app.sudoku.gowithsally.com`
  - **Expo Go dev** (`npx expo start`) → for live-edit on your laptop
- All three hit **the same backend** (`api.sudoku.gowithsally.com`) — same accounts, same challenges, same leaderboard.
- **idriss1 / idriss2 / idrissmobile** demo accounts work identically on web and APK.

### Backoffice = Mongo Express + Redis Commander, fronted by Caddy basic-auth
- `db.sudoku.gowithsally.com` (Mongo Express) — browse collections, run queries, edit docs.
- `cache.sudoku.gowithsally.com` (Redis Commander) — inspect keys, TTLs, pub/sub.
- Both protected by the same `UI_USER` / `UI_PASS` GitHub Secrets.

### Database changes
- **No migrations framework** — Mongo is schema-flexible. New fields are added by the API on first write; backfills go through `backend/scripts/crud.js` or `backend/scripts/seed.js` run inside the `sudoku-api` container.
- **Volumes are persistent**: `sudoku_mongo_data` + `sudoku_redis_data` survive `docker compose up -d --build`. `down -v` would wipe them (don't).

### Local dev ⇄ prod parity
| | Local laptop | Production VPS |
|---|---|---|
| Backend | `cd backend && docker compose up -d` → host ports 3101 / 27117 / 8181 | `deploy/docker-compose.prod.yml` — no exposed host ports, fronted by Caddy |
| Mongo | `localhost:27117` | `sudoku-mongo:27017` (private net) |
| Redis | `localhost:6379` | `sudoku-redis:6379` (private net, password) |
| Landing | `cd landing && npx serve` | nginx container behind Caddy |
| Mobile dev | `npx expo start` + uncomment the dev block | Release APK hits prod API directly |
| TURN | uses prod `turn.salistar.com` | same |

The local stack ports are deliberately **off-by-100** (3101/27117/8181) so two stacks can run side-by-side without clashing. The mobile dev block uses the device-reachable `expoConfig.hostUri` so a phone on the same Wi-Fi can hit your laptop.

---

## 🚀 Run the backend locally with Docker

```bash
cd backend
docker compose up -d
```
This starts three containers (see [`backend/docker-compose.yml`](./backend/docker-compose.yml)):

| Service | Host port | URL |
|---------|-----------|-----|
| `sudoku_sally_api` (Express + Socket.IO) | **3101** → 3001 | http://localhost:3101 · health: `/health` |
| `sudoku_sally_mongo` (MongoDB 7) | **27117** → 27017 | `mongodb://localhost:27117` |
| `sudoku_sally_admin` (mongo-express) | **8181** → 8081 | http://localhost:8181 (admin / admin123) |

```bash
# quick checks
curl http://localhost:3101/health
curl -X POST http://localhost:3101/api/auth/guest      # → { success, token, user }

docker compose logs -f api      # tail logs
docker compose down             # stop (add -v to wipe the mongo volume)
```

The mobile app is **hard-wired to the production API** (`https://api.sudoku.gowithsally.com`) in every shipped build — there is no runtime dev toggle and no `localhost` URL reachable from the APK. To develop against this local backend instead, uncomment the dev block at the top of `mobile/utils/api.ts`, `mobile/utils/socket.ts`, `mobile/app/challenges.tsx` and `mobile/app/challenge-game.tsx` (it's guarded by `__DEV__` so it can never leak into a release APK).

---

## 🌍 Web build of the app (same React Native code, runs in the browser)

The mobile app code is also exported to a static web app via **react-native-web** — same screens, same backend, no native modules required (Google sign-in falls back to email/guest on web).

```bash
# 1) build the web bundle (writes mobile/dist/)
cd mobile
npx expo export --platform web

# 2) tar + ship + build the container on the server
tar -czf /tmp/web.tgz dist Dockerfile.web nginx-web.conf
scp -i ~/.ssh/gowithsally /tmp/web.tgz deploy@88.198.205.229:/tmp/
ssh -i ~/.ssh/gowithsally deploy@88.198.205.229 '
  mkdir -p ~/apps/sudoku-web && rm -rf ~/apps/sudoku-web/dist
  tar -xzf /tmp/web.tgz -C ~/apps/sudoku-web && mv ~/apps/sudoku-web/Dockerfile.web ~/apps/sudoku-web/Dockerfile
  cd ~/apps/sudoku-web && docker build -t sudoku-sally-web:latest .
  docker rm -f sudoku-web 2>/dev/null
  docker run -d --name sudoku-web --restart unless-stopped --network gowithsally_gws-net sudoku-sally-web:latest'

# 3) Caddy block (idempotent) + DNS record  app.sudoku.gowithsally.com → 88.198.205.229 (grey cloud)
#    see the existing pattern in deploy/Caddyfile.snippet — same shape:
#    app.sudoku.gowithsally.com { encode gzip zstd; reverse_proxy sudoku-web:80 }
```

Live at https://app.sudoku.gowithsally.com.

---

## 📲 Run the mobile app

```bash
cd mobile
npm install
npx expo start --dev-client     # Metro for an installed dev build
# or build & install a dev client on a connected device:
npx expo run:android
```
If the phone is on mobile data (not the same Wi-Fi as the PC), tunnel Metro over USB:
```bash
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW \
  -d "com.sudokusally.v3://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

---

## 🐙 Push to GitHub

```bash
git add -A
git commit -m "feat: my change"
git push origin main
```
Pushing to `main` automatically triggers CI (see below). Cut a release of the APK with a version tag:
```bash
git tag v3.1.3
git push origin v3.1.3        # → builds the APK and attaches it to Release v3.1.3
```

---

## 🤖 How the CI/CD works (GitHub Actions)

Two workflows in [`.github/workflows/`](./.github/workflows):

### 1. `build-apk.yml` — builds the **production-grade Android APK**
- **Triggers:** push to `main` touching `mobile/**`, any `v*` tag, or manual dispatch.
- **Steps:** checkout → setup Node 18 / JDK 17 → `npm ci --legacy-peer-deps` → `expo prebuild --platform android` → restore the keystore from `ANDROID_DEBUG_KEYSTORE_B64` → trim ABIs to `arm64-v8a + armeabi-v7a` → **`gradlew assembleRelease`** → stage `app-release.apk` → upload artifact → **on a `v*` tag, attach to a GitHub Release**.
- **Release variant (not debug):**
  - JS bundle is **baked into the APK** via the React Gradle plugin → no Metro needed, no `localhost:8081` connection at runtime, no red box.
  - **Hermes bytecode** → faster cold start, smaller binary.
  - **Signed** with the OAuth-registered keystore (`signingConfigs.debug` is reused for `release` — same SHA-1 so Google sign-in keeps working). This is the **same artifact you would later upload to Google Play Console**.
  - **Trimmed ABIs** → APK is ~80 MB instead of ~190 MB (every real Android device on the market runs `arm64-v8a` or `armeabi-v7a`).

### 2. `deploy.yml` — deploys the backend/landing stack to the VPS
- **Triggers:** push to `main` touching `backend/**`, `landing/**`, `deploy/**`.
- **Steps:** `appleboy/ssh-action` SSHes into **server 2** as `deploy`, then runs [`deploy/deploy.sh`](./deploy/deploy.sh): `git pull` → write `deploy/.env.prod` from secrets → `docker compose -f deploy/docker-compose.prod.yml up -d --build` → download the latest APK into the landing container so the download page self-hosts it.

### Required GitHub secrets
| Secret | Used by | Value / purpose |
|--------|---------|------|
| `ANDROID_DEBUG_KEYSTORE_B64` | build-apk | base64 of `mobile/android/app/debug.keystore` (its SHA-1 is registered with Google OAuth) |
| `SERVER_HOST` | deploy | `88.198.205.229` |
| `SERVER_USER` | deploy | `deploy` |
| `SERVER_SSH_KEY` | deploy | private key authorized on server 2 (`~/.ssh/gowithsally`) |
| `JWT_SECRET` | deploy | backend JWT signing secret |
| `REDIS_PASSWORD` | deploy | Redis password (sudoku-redis + redis-commander) |
| `UI_USER` / `UI_PASS` | deploy | basic-auth creds for the Mongo/Redis admin UIs |
| `TURN_SHARED_SECRET` | deploy | shared HMAC secret for the `turn.salistar.com` coturn server |
| `CF_API_TOKEN` *(optional)* | deploy | Cloudflare API token (scope: zone-edit on `gowithsally.com`) — if set, `deploy.sh` purges the CDN cache for the APK URL after every deploy so users see the new APK instantly |
| `CF_ZONE_ID` *(optional)* | deploy | Cloudflare zone ID for `gowithsally.com` — paired with `CF_API_TOKEN` |

```bash
# set a secret from the CLI
printf '88.198.205.229' | gh secret set SERVER_HOST --repo salistar/sudo-sally
gh secret set SERVER_SSH_KEY --repo salistar/sudo-sally < ~/.ssh/gowithsally
```

---

## 📦 Deploy the mobile APK via CI + watch it

```bash
# 1. tag a version → triggers build-apk.yml (build + Release)
git tag v3.1.3 && git push origin v3.1.3

# 2. find the run and WATCH it to completion
rid=$(gh run list --repo salistar/sudo-sally --workflow build-apk.yml \
        --branch v3.1.3 --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$rid" --repo salistar/sudo-sally --exit-status

# 3. confirm the APK is attached to the Release
gh release view v3.1.3 --repo salistar/sudo-sally --json assets \
  --jq '.assets[] | {name, size}'
```
The download page (`/download.html`) links to `releases/latest`, and `deploy.sh` also self-hosts the latest APK at `https://sudoku.gowithsally.com/downloads/sudoku-sally.apk`. To refresh the self-hosted copy after a new release:
```bash
ssh -i ~/.ssh/gowithsally deploy@88.198.205.229 '
  tmp=$(mktemp)
  curl -fsSL https://github.com/salistar/sudo-sally/releases/latest/download/sudoku-sally.apk -o "$tmp"
  docker cp "$tmp" sudoku-landing:/usr/share/nginx/html/downloads/sudoku-sally.apk
  docker exec sudoku-landing chmod 644 /usr/share/nginx/html/downloads/sudoku-sally.apk
  rm -f "$tmp"'
```

---

## ☁️ Deploy the containers on the VPS (full walkthrough)

### 0. Connect
```bash
ssh -i ~/.ssh/gowithsally deploy@88.198.205.229      # root login is disabled
```

### 1. Get the code + secrets on the server
```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/salistar/sudo-sally.git
cd sudo-sally/deploy
cat > .env.prod <<EOF
JWT_SECRET=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 24)
UI_USER=sally
UI_PASS=$(openssl rand -hex 12)
EOF
chmod 600 .env.prod
```

### 2. Build & launch the containers
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```
This builds and starts: `sudoku-landing`, `sudoku-api`, `sudoku-mongo`, `sudoku-redis`, `sudoku-mongo-ui`, `sudoku-redis-ui`.
The public-facing ones join the **external `gowithsally_gws-net`** network so Caddy can reach them by name; data stores stay on the private `sudoku_net`. **No host ports are published** — Caddy fronts everything on 443.

> The whole thing is also automated by [`deploy/deploy.sh`](./deploy/deploy.sh) (used by CI). Run it manually with: `JWT_SECRET=… REDIS_PASSWORD=… UI_USER=… UI_PASS=… bash deploy/deploy.sh`.

### 3. Create the sub-domains (Cloudflare DNS → server IP)
DNS for `gowithsally.com` is on Cloudflare. Add A records pointing each host to the VPS IP. Via the dashboard (DNS → Add record) **or** the API:
```bash
TOKEN=<cloudflare-zone-dns-edit-token>
ZONE=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=gowithsally.com" \
  -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"][0]["id"])')

# apex app domain → Proxied (orange) is fine (covered by Cloudflare's *.gowithsally.com cert)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"A","name":"sudoku","content":"88.198.205.229","proxied":true}'

# 2-level hosts (api/db/cache.sudoku) → DNS-only (grey): Cloudflare's universal cert
# does NOT cover *.sudoku.gowithsally.com, so let Caddy issue per-host certs instead.
for h in api.sudoku db.sudoku cache.sudoku; do
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"$h\",\"content\":\"88.198.205.229\",\"proxied\":false}"
done
```

### 4. Wire the sub-domains to the containers (Caddy reverse proxy)
Append the blocks from [`deploy/Caddyfile.snippet`](./deploy/Caddyfile.snippet) to the box's Caddyfile (`~/apps/go-with-sally-backoffice/Caddyfile`):
```caddy
sudoku.gowithsally.com      { encode gzip zstd; reverse_proxy sudoku-landing:80 }
api.sudoku.gowithsally.com  { encode gzip zstd; reverse_proxy sudoku-api:3001 { header_up X-Forwarded-Proto https } }
db.sudoku.gowithsally.com   { encode gzip zstd; reverse_proxy sudoku-mongo-ui:8081 }
cache.sudoku.gowithsally.com{ encode gzip zstd; basic_auth { sally <bcrypt-hash> }; reverse_proxy sudoku-redis-ui:8081 }
```
Then validate & apply (a **restart** reliably re-issues certs for new hosts; a plain reload may not):
```bash
docker exec gws-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker restart gws-caddy
# generate a bcrypt hash for basic_auth:
docker exec sudoku-api node -e "console.log(require('bcryptjs').hashSync('<UI_PASS>',12))"
```
Caddy automatically obtains Let's Encrypt certificates over HTTP-01 once the DNS records resolve to the server.

### 5. Verify the live services
```bash
curl -sI https://sudoku.gowithsally.com/                       # 200 (CDN: server: cloudflare)
curl -s  https://api.sudoku.gowithsally.com/health             # {"status":"ok"} → 200
curl -X POST https://api.sudoku.gowithsally.com/api/auth/guest  # { success, token }
# db/cache UIs prompt for basic auth (UI_USER / UI_PASS)
```

### Day-to-day ops
```bash
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml ps
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml logs -f api
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml restart api
```

---

## 🔐 Google sign-in — full prod walkthrough

> **Server side is already wired (v3.2.1):** the backend exposes `POST /api/auth/google`, which verifies the Google ID token via the official `tokeninfo` endpoint, upserts a user (keyed on Google `sub`), and returns one of *our* JWTs. The **mobile native** flow (`@react-native-google-signin`) and the **web** flow (Google Identity Services / GSI) BOTH POST to that same endpoint. If a Google account signs in for the first time, a real Sudoku Sally account is created from the Google profile (username derived from `given_name`, avatar 🎮). If the email is already used by an email/password account, the two are *linked* (no duplicate is created).

### What's in your Google Cloud Console (3 OAuth clients, 1 project)

| Client | Type | Used by | Identifier env / file |
|---|---|---|---|
| **Web** | OAuth Web | • Mobile native (Google insists the `webClientId` is passed to `GoogleSignin.configure()` on Android — even though the user picks an Android account) <br>• Web GSI button | `mobile/utils/googleAuth.ts → GOOGLE_CLIENT_IDS.web` <br>`backend GOOGLE_ALLOWED_AUDS` |
| **Android** | OAuth Android | Implicit — Google matches the app by `(package = com.sudokusally.v3, signing-cert SHA-1)`. NOT passed to `configure()`. | Google Cloud → Credentials |
| **iOS** | OAuth iOS | Future iOS build | `mobile/utils/googleAuth.ts → GOOGLE_CLIENT_IDS.ios` |

The **single Web client ID is the `aud` claim of every ID token** the app produces (mobile + web). The backend's `GOOGLE_ALLOWED_AUDS` env var whitelists exactly that one (plus the Android one for forward-compatibility). If you spin up a new Web client (e.g. a separate staging project), add its ID to that comma-separated list.

### Testing mode (where you are now)

While the OAuth consent screen is in **Testing**, **only emails listed under *Test users* can sign in** (everyone else gets `403 access_denied`). To open it to every Google account, you publish the consent screen. The app only requests the *basic* scopes (`openid`, `email`, `profile`), so Google **does not require an app verification** — publishing is instant.

### Step-by-step

1. **Open the consent screen**
   - https://console.cloud.google.com → top bar → pick your project (the same one that owns the **Web** + **Android** OAuth clients used by the app).
   - Left menu → **APIs & Services → OAuth consent screen**.

2. **Confirm User type = External**
   - On the consent-screen page, make sure **User type: External** is shown. (Internal is only for Google Workspace.)

3. **Fill the required fields** (do this before publishing)
   - **App name**: `Sudoku Sally`
   - **User support email**: your Gmail (e.g. `salistarcompany@gmail.com`)
   - **App logo**: optional in basic mode (recommended: a 120 × 120 PNG).
   - **Application home page**: `https://sudoku.gowithsally.com`
   - **Application privacy policy**: `https://sudoku.gowithsally.com/privacy.html` ✅ (already live)
   - **Application terms of service**: optional.
   - **Authorized domains**: add `gowithsally.com`.
   - **Developer contact information**: your email.
   - → **Save and continue**.

4. **Scopes** — keep only the basic three
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` → **Save and continue**. *Do not add sensitive/restricted scopes — that's what would trigger verification.*

5. **Publish the app**
   - Back on the **OAuth consent screen** summary, look for **Publishing status: Testing**.
   - Click **PUBLISH APP** → in the dialog **Push to production**, confirm.
   - Status becomes **In production**. ✅ Done — any Google account can now sign in.

### After publishing — verify each surface in 30 seconds

```bash
# 1. The Web client ID is the only `aud` value the backend accepts.
#    Confirm by hitting tokeninfo with a token captured from the GSI button:
curl -s "https://oauth2.googleapis.com/tokeninfo?id_token=$ID_TOKEN" | python -m json.tool | grep -E "aud|iss|email"
# → aud should be    106972968307-o1m39edcftpo3r77q856o87o29b1ai4u.apps.googleusercontent.com
# → iss should be    https://accounts.google.com
# → email_verified   true

# 2. Backend trade-in works:
curl -s -X POST https://api.sudoku.gowithsally.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"$ID_TOKEN\"}" | python -m json.tool
# → { success: true, token: "<our JWT>", user: { username, email, googleId, ... }, provider: "google" }

# 3. Verify the user landed in Mongo (db.sudoku.gowithsally.com or shell):
docker exec sudoku-mongo mongosh sudoku_sally --quiet \
  --eval 'db.users.find({googleId:{$exists:true}},{username:1,email:1,googleId:1,createdAt:1}).pretty()'
```

### Common Testing→Production gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Web GSI button silently does nothing | Cross-Origin-Opener-Policy blocked the popup | Use the One Tap embed (already default in our `googleAuth.web.ts`) or load the app in a top-level window |
| `error: bad aud` from backend | Mobile sent the **Android** client ID as `aud` (rare — happens if you put the Android ID in `configure({webClientId})`) | Always pass the **Web** client ID to `configure()`. Native SDK picks the right Android client by `(package, SHA-1)` automatically |
| New Google users still land as Guest | Mobile build is older than v3.2.1 → no backend trade-in step | Reinstall the v3.2.1 APK (or newer) |
| `403 access_denied` for non-test Google accounts | Consent screen still in Testing | Run step 5 above (Push to production) |
| Need to revoke a linked Google session | n/a — app-side | User taps **Logout** → next sign-in re-prompts the picker (we already call `GoogleSignin.signOut()` before every `signIn()`) |


### Checklist — Google sign-in works end-to-end

| Item | Where | Value |
|---|---|---|
| **Android OAuth client** package | Google Cloud → Credentials | `com.sudokusally.v3` |
| **Android OAuth client** SHA-1 (debug) | Google Cloud → Credentials | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| **Android OAuth client** SHA-1 (Play Store) | add later when you upload to Play | the **App signing certificate SHA-1** shown in *Play Console → Setup → App signing* |
| **Web OAuth client ID** used by the app | `mobile/utils/googleAuth.ts` → `GOOGLE_CLIENT_IDS.web` | the *Web application* client ID (NOT the Android one) |
| Both OAuth clients live in the **same** Google Cloud project | Credentials list | ✓ |
| OAuth consent screen | **In production** | ✓ (step 5 above) |

### Common errors → fix

| Symptom on the device | Cause | Fix |
|---|---|---|
| `DEVELOPER_ERROR (code 10)` | SHA-1 not registered / wrong | Add the **exact** SHA-1 from `mobile/android/app/debug.keystore` to the **Android** OAuth client |
| `403 access_denied` while consent is Testing | account not in Test users | Add the email under *Test users*, **or** publish (step 5) |
| `Sign in failed` with no clear code | Web Client ID missing | Set `webClientId` in `mobile/utils/googleAuth.ts` to the **Web** OAuth client ID |
| `NO_MODULE` popup | running in Expo Go | Use a dev / release build (the native module isn't in Expo Go) |

---

## 📈 Monitoring — what we have and what to add

### Already in place (no extra setup)
- **Docker healthchecks** on `sudoku-api` (HTTP `/health`), `sudoku-mongo` (`mongosh ping`), `sudoku-redis` (`redis-cli ping`), `sudoku-landing` (HTTP). Visible in `docker ps` and `docker inspect`. Compose restarts unhealthy containers (`restart: unless-stopped`).
- **Caddy access logs + auto-TLS rotation** for the four sub-domains.
- **GitHub badges** at the top of this README — green when the latest build/deploy passed and when the live URLs respond.

### Tier 1 — Uptime (5 min to wire, recommended next)
- **External pings every minute** on the public URLs from anywhere on the planet.
  - https://sudoku.gowithsally.com/ (HTTP 200 + content match "Sudoku Sally")
  - https://api.sudoku.gowithsally.com/health (HTTP 200 + JSON match `"status":"ok"`)
- Free options:
  - **UptimeRobot** — 50 monitors free, e-mail/Slack alerts.
  - **Better Stack / Better Uptime** — nicer UI, status page, free tier.
  - Self-hosted: **Uptime-Kuma** as a single container next to the existing stack — beautiful status page at `status.sudoku.gowithsally.com`.

### Tier 2 — Metrics & dashboards
- **Prometheus + Grafana** as two extra containers on `gowithsally_gws-net`, plus a `prom-client` middleware in `backend/` to expose `/metrics` (request rate, latency p50/p95/p99, error rate, socket connections, Mongo/Redis pool health). Mirror the pattern the GoWithSally backoffice already uses on the same VPS. A new sub-domain `grafana.sudoku.gowithsally.com` (DNS-only, Caddy basic-auth) would host the dashboard.

### Tier 3 — Centralized logs
- Add **Loki + Promtail** (or **Filebeat → Logstash → Elasticsearch + Kibana** — already used by GoWithSally). All container stdout/stderr ends up searchable, with retention rules. Query: "all 5xx in the last hour on `sudoku-api`".

### Tier 4 — App + crash analytics
- **Sentry** (free tier) wired into the **mobile** app for crash reports + perf, and into the **backend** for unhandled errors. Two SDK installs, one DSN per project. Lets you see real-device crashes from users.
- **Plausible** or **Umami** (self-hosted) for landing-site analytics — privacy-friendly, no cookie banner needed.

### Recommended minimum
Tier 1 today (UptimeRobot or Uptime-Kuma), Tier 4 (Sentry) when the app gets a few users, Tier 2 when you start tweaking performance.

---

## ✅ What's verified working

- Landing, API (`/health`, guest auth), Mongo & Redis admin UIs — all live over HTTPS.
- **Real 1v1 challenge match** end-to-end on the prod backend (challenge → accept → play → finish → winner by time/errors → stats).
- APK builds in CI, signed so **Google sign-in works**, attached to Releases and self-hosted on the site.

---

© 2026 Sudoku Sally
