import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "256kb" }));

const API_KEY = process.env.DONATION_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function mask(s = "") {
  if (!s) return "";
  if (s.length <= 8) return "********";
  return s.slice(0, 4) + "…" + s.slice(-4);
}

app.use((req, res, next) => {
  console.log("REQ", req.method, req.url);
  next();
});

app.get("/", (req, res) => res.status(200).send("ok"));

app.get("/health", async (req, res) => {
  const envOk = !!(API_KEY && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
  return res.json({
    ok: true,
    envOk,
    supabaseUrlHost: SUPABASE_URL ? new URL(SUPABASE_URL).host : null,
    apiKey: mask(API_KEY),
    serviceKey: mask(SUPABASE_SERVICE_ROLE_KEY),
  });
});

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FALTAN ENV VARS: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
} else {
  console.log("SUPABASE_URL:", SUPABASE_URL);
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

app.post("/roblox/donation", async (req, res) => {
  const headerKey = req.get("X-Api-Key") || "";
  if (!API_KEY) {
    console.error("DONATION_API_KEY no está seteado en Render env vars");
    return res.status(500).json({ ok: false, error: "missing_api_key_env" });
  }
  if (headerKey !== API_KEY) {
    console.warn("401 BAD API KEY", { got: mask(headerKey) });
    return res.status(401).json({ ok: false, error: "bad_api_key" });
  }
  if (!supabase) {
    console.error("Supabase client no inicializado (env vars faltantes)");
    return res.status(500).json({ ok: false, error: "supabase_not_configured" });
  }

  try {
    const d = req.body || {};
    console.log("DONATION BODY:", d);

    const receiptId = String(d.receiptId || "");
    const userId = Number(d.userId);
    const username = String(d.username || "");
    const amount = Number(d.amount);
    const productId = Number(d.productId);
    const placeId = Number(d.placeId);
    const universeId = Number(d.universeId);
    const jobId = String(d.jobId || "");
    const ts = Number(d.ts) || Math.floor(Date.now() / 1000);

    if (!receiptId || !Number.isFinite(userId) || !Number.isFinite(amount) || !Number.isFinite(productId)) {
      return res.status(400).json({ ok: false, error: "bad_payload" });
    }

    const { error } = await supabase.from("donations").insert({
      receipt_id: receiptId,
      user_id: userId,
      username,
      amount,
      product_id: productId,
      place_id: Number.isFinite(placeId) ? placeId : null,
      universe_id: Number.isFinite(universeId) ? universeId : null,
      job_id: jobId || null,
      ts,
    });

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      return res.status(500).json({ ok: false, error: "supabase_insert_failed", detail: error.message });
    }

    console.log("DONATION SAVED OK:", receiptId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DONATION HANDLER ERROR:", err);
    return res.status(500).json({ ok: false, error: "server_exception" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on", port));
