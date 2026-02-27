import express from "express";

const app = express();
app.use(express.json({ limit: "256kb" }));

const API_KEY = process.env.DONATION_API_KEY;

const seen = new Set(); // en memoria (solo para probar). En DB real, haz unique en receiptId.

app.get("/", (req, res) => res.send("ok"));

app.post("/roblox/donation", async (req, res) => {
  if (!API_KEY) return res.status(500).json({ ok: false, error: "missing_api_key" });
  if (req.get("X-Api-Key") !== API_KEY) return res.status(401).json({ ok: false });

  const d = req.body || {};
  if (!d.receiptId || !d.userId || typeof d.amount !== "number") {
    return res.status(400).json({ ok: false, error: "bad_payload" });
  }

  // Anti duplicados básico (para pruebas)
  if (seen.has(d.receiptId)) return res.json({ ok: true, duplicate: true });
  seen.add(d.receiptId);

  // Aquí luego guardas en DB (Mongo/Postgres/etc)
  console.log("DONATION:", d);

  return res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("listening on", port));
