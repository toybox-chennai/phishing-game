const rooms = globalThis.__PHISH_SIGNAL_ROOMS || (globalThis.__PHISH_SIGNAL_ROOMS = new Map());

function clean(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "POST") {
    const { code, id, offer, answer, candidate } = req.body || {};
    const room = clean(code);
    if (!room || !id) return res.status(400).json({error:"Invalid signal"});

    let bucket = rooms.get(room);
    if (!bucket) { bucket = new Map(); rooms.set(room, bucket); }
    bucket.set(String(id), {
      offer: offer || null,
      answer: answer || null,
      candidate: candidate || null,
      t: Date.now()
    });

    // Vercel serverless memory is ephemeral. This endpoint is intentionally
    // only a tiny signaling relay; the actual game data travels over WebRTC.
    return res.json({ok:true});
  }

  if (req.method === "GET") {
    const room = clean(req.query.code);
    const id = String(req.query.id || "");
    const bucket = rooms.get(room);
    if (!bucket) return res.json({});
    const result = {};
    for (const [peer, data] of bucket) if (peer !== id) result[peer] = data;
    return res.json(result);
  }

  return res.status(405).end();
}