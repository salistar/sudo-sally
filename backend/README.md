# 🧩 Sudoku Sally V3 - Backend API

## 📋 Table of Contents
1. [Architecture](#architecture)
2. [Installation](#installation)
3. [API Endpoints](#api-endpoints)
4. [Database Schema](#database-schema)
5. [Scripts](#scripts)
6. [Deployment](#deployment)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SUDOKU SALLY V3                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Mobile    │  │    Web      │  │   Admin     │         │
│  │  (Expo Go)  │  │  (React)    │  │  Dashboard  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                    ┌─────▼─────┐                            │
│                    │    API    │                            │
│                    │  Express  │                            │
│                    │  :3001    │                            │
│                    └─────┬─────┘                            │
│                          │                                  │
│                    ┌─────▼─────┐                            │
│                    │  MongoDB  │                            │
│                    │  :27017   │                            │
│                    └───────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation

### Option 1: Docker (Recommandé)

```bash
# Clone et lancer
git clone <repo>
cd SudokuSallyBackend

# Créer le fichier .env
cp .env.example .env

# Lancer avec Docker Compose
docker-compose up -d

# Vérifier que tout fonctionne
curl http://localhost:3001/health
```

### Option 2: Local

```bash
# Installer MongoDB localement d'abord
# https://www.mongodb.com/docs/manual/installation/

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# Lancer le serveur
npm run dev

# Initialiser la base de données
npm run seed
```

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Créer un compte | `{ username, email, password }` |
| POST | `/api/auth/login` | Connexion | `{ email, password }` |
| POST | `/api/auth/guest` | Connexion invité | - |
| GET | `/api/auth/me` | Profil actuel | - (Bearer token) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Liste tous les utilisateurs |
| GET | `/api/users/:id` | Détails d'un utilisateur |
| PUT | `/api/users/:id` | Modifier un utilisateur |
| DELETE | `/api/users/:id` | Supprimer un utilisateur |
| PUT | `/api/users/:id/settings` | Modifier les paramètres |

### Games

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/games/start` | Démarrer une partie | `{ levelNumber, isDaily }` |
| POST | `/api/games/save` | Sauvegarder | `{ gameId, currentBoard, timeSpent }` |
| POST | `/api/games/complete` | Terminer | `{ gameId, won, timeSpent, errors, stars }` |
| GET | `/api/games/history` | Historique | - |

### Levels

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/levels` | Liste des 30 niveaux |
| GET | `/api/levels/:id` | Détails d'un niveau |

### Leaderboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard` | Classement global |
| GET | `/api/leaderboard/weekly` | Classement hebdomadaire |
| GET | `/api/leaderboard/me` | Mon classement |

### Daily Challenge

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/daily` | Challenge du jour |
| POST | `/api/daily/complete` | Compléter le challenge |

### Shop

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shop` | Articles disponibles |
| POST | `/api/shop/buy` | Acheter un article |

### Achievements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/achievements` | Tous les succès |
| GET | `/api/achievements/me` | Mes succès |
| POST | `/api/achievements/:id/unlock` | Débloquer |

---

## 🗄️ Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  avatar: String (emoji),
  role: 'user' | 'premium' | 'admin',
  
  // Progression
  level: Number,
  xp: Number,
  coins: Number,
  stars: Number,
  completedLevels: [Number],
  
  // Statistiques
  stats: {
    gamesPlayed: Number,
    gamesWon: Number,
    totalTime: Number,
    currentStreak: Number,
    bestStreak: Number,
    perfectGames: Number
  },
  
  // Paramètres
  settings: {
    language: 'en' | 'fr' | 'ar',
    sound: Boolean,
    theme: String
  }
}
```

### Games Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  level: Number,
  status: 'playing' | 'won' | 'lost' | 'abandoned',
  timeSpent: Number,
  errors: Number,
  hintsUsed: Number,
  stars: Number,
  startedAt: Date,
  completedAt: Date
}
```

### Levels Collection
```javascript
{
  _id: ObjectId,
  levelNumber: Number (1-30),
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' | 'master',
  puzzle: String (JSON),
  solution: String (JSON),
  rewards: { xp: Number, coins: Number }
}
```

---

## 🔧 Scripts

```bash
# Initialiser la base avec des données de test
npm run seed

# Sauvegarder la base de données
npm run backup

# Restaurer une sauvegarde
npm run restore backups/backup_2024-01-01.json

# Surveiller les statistiques
npm run monitor

# Nettoyer les vieilles données
npm run clean --games    # Supprimer les parties anciennes
npm run clean --guests   # Supprimer les comptes invités > 7 jours
```

---

## 🌐 Deployment Options

### 1. Railway.app (Recommandé - Gratuit)
```bash
# Installer Railway CLI
npm i -g @railway/cli

# Déployer
railway login
railway init
railway up

# Ajouter MongoDB
railway add mongodb
```

### 2. Render.com
- Créer un Web Service (backend)
- Créer une Database MongoDB
- Lier les deux

### 3. DigitalOcean App Platform
- $5/mois pour l'app
- $15/mois pour MongoDB

### 4. VPS (Production)
```bash
# Sur un VPS Ubuntu 22.04
sudo apt update
sudo apt install docker.io docker-compose

# Cloner le projet
git clone <repo>
cd SudokuSallyBackend

# Lancer
docker-compose up -d
```

### Variables d'environnement pour la production
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/sudoku_sally
JWT_SECRET=<generate_strong_secret_key>
```

---

## 🔐 Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@sudokusally.com | admin123 | Admin |
| test@test.com | test123 | User |
| demo@demo.com | demo | User |

---

## 📊 Monitoring

Accéder à Mongo Express (interface admin):
- URL: http://localhost:8081
- Username: admin
- Password: admin123

