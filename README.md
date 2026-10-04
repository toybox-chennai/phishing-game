# Phish Finder — Vercel + WebRTC

This version has **no Firebase and no database**.

Vercel hosts:
- the static game
- a tiny `/api/signal` endpoint used for WebRTC signaling

The actual multiplayer game traffic is intended to travel peer-to-peer through WebRTC DataChannels.

## Deploy

1. Push the repository to GitHub.
2. Import it into Vercel.
3. Deploy.

No build command is required.

## Important technical limitation

Vercel serverless functions do not provide durable shared memory or an always-running WebSocket server. The signaling endpoint therefore uses ephemeral serverless memory.

That means this is suitable for a prototype/friend-group game, but it is **not a guaranteed production signaling service**. A serverless instance can restart and erase pending signaling state.

The WebRTC data channel itself is peer-to-peer after connection.

## Game limitation

The current prototype makes the host authoritative for round progression and scoring. It is intentionally lightweight and not cheat-resistant.

For a public competitive release, use a durable signaling service and an authoritative backend.

## Safety

All emails are simulated. The game does not collect real credentials or payment information.
