# 🛡️ Phish Finder — Vercel Edition

A real-time multiplayer phishing-awareness game that can be deployed as a **single Vercel project**.

## Why Firebase?

Vercel is excellent for static/frontend deployment, but it is not a traditional always-on WebSocket server. This version therefore stores the live room state in **Firebase Realtime Database**. Players connected to the same room receive state changes in real time.

Architecture:

```text
Browser
   │
   ├── Vercel ── HTML/CSS/JS
   │
   └── Firebase Realtime Database ── shared room state
```

## 1. Create Firebase project

1. Open Firebase Console.
2. Create a project.
3. Add a **Web app**.
4. Copy its configuration.
5. Enable **Realtime Database**.

## 2. Configure the frontend

Copy:

```text
public/firebase-config.example.js
```

to:

```text
public/firebase-config.js
```

Paste your Firebase web configuration into it.

The file is ignored by the repository starter only if you add it to `.gitignore`. For a simple public game, the Firebase web config itself is not a secret. **The database security rules are what matter.**

## 3. Realtime Database rules

For a quick prototype, you can use permissive rules:

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

This is suitable only for a prototype. It allows anyone who knows a room path to modify it.

For a public production game, do NOT leave this configuration in place. Add Firebase Authentication and strict validation rules before putting it in front of strangers.

## 4. Deploy to Vercel

Push this folder to GitHub.

Then in Vercel:

1. Add New Project.
2. Import the GitHub repository.
3. Framework preset: **Other**.
4. Build command:

```text
npm run build
```

5. Output directory:

```text
public
```

6. Deploy.

Because the app is static, there is no Node server to keep alive.

## Important

The game currently trusts the browser for scoring and room state. That is acceptable for a friend-group prototype but **not cheat-resistant**.

For a serious competitive version, move authoritative scoring/game transitions to a trusted backend or Firebase Cloud Functions and add authentication/rate limits.

## Local testing

You can use any static server, for example:

```bash
npx serve public
```

Then open the displayed URL in two browser windows and join the same room.

## Game content

All emails are fictional/simulated. The game does not collect real passwords, payment information, cookies, or credentials.
