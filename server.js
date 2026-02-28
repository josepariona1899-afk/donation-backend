import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "256kb" }));

const API_KEY = process.env.DONATION_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

app.get("/", (req, res) => res.send("ok"));

app.get("/health", async (req, res) => {
  try {
    const envOk = !!API_KEY && !!SUPABASE_URL && !!SUPABASE_SERVICE_ROLE_KEY;
    return res.json({ ok: true, envOk });
  } catch {
    return res.status(500).json({ ok: false });
  }
});

app.post("/roblox/donation", async (req, res) => {
  try {
    if (req.get("X-Api-Key") !== API_KEY) {
      return res.status(401).json({ ok: false, error: "bad_api_key" });
    }

    const d = req.body;

    const { error } = await supabase
      .from("donations")
      .insert({
        receipt_id: String(d.receiptId || ""),
        user_id: Number(d.userId),
        username: String(d.username || ""),
        amount: Number(d.amount) || 0,
        product_id: Number(d.productId),
        place_id: Number(d.placeId),
        universe_id: Number(d.universeId),
        job_id: String(d.jobId || ""),
        ts: Number(d.ts) || Math.floor(Date.now() / 1000)
      });

    if (error) {
      console.error("insert error:", error);
      return res.status(500).json({ ok: false, error: "insert_failed" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("post exception:", err);
    return res.status(500).json({ ok: false, error: "server_exception" });
  }
});

// GET /roblox/leaderboard?scope=global|universe|place&universeId=...&placeId=...&limit=10&month=YYYY-MM
app.get("/roblox/leaderboard", async (req, res) => {
  try {
    if (req.get("X-Api-Key") !== API_KEY) {
      return res.status(401).json({ ok: false, error: "bad_api_key" });
    }

    const scope = String(req.query.scope || "global"); // global | universe | place
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 100));

    const universeId = Number(req.query.universeId);
    const placeId = Number(req.query.placeId);
    const month = String(req.query.month || ""); // "2026-02"

    let q = supabase.from("donations").select("user_id, username, amount, universe_id, place_id, ts");

    if (scope === "universe" && Number.isFinite(universeId)) q = q.eq("universe_id", universeId);
    if (scope === "place" && Number.isFinite(placeId)) q = q.eq("place_id", placeId);

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = new Date(`${month}-01T00:00:00Z`).getTime() / 1000;
      const endDate = new Date(`${month}-01T00:00:00Z`);
      endDate.setUTCMonth(endDate.getUTCMonth() + 1);
      const end = endDate.getTime() / 1000;

      q = q.gte("ts", Math.floor(start)).lt("ts", Math.floor(end));
    }

    const { data, error } = await q;
    if (error) {
      console.error("select error:", error);
      return res.status(500).json({ ok: false, error: "select_failed" });
    }

    const totals = new Map();
    for (const row of data || []) {
      const uid = row.user_id;
      const prev = totals.get(uid) || { userId: uid, username: row.username, total: 0 };
      prev.total += Number(row.amount) || 0;
      if (row.username) prev.username = row.username;
      totals.set(uid, prev);
    }

    const rows = Array.from(totals.values())
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, limit);

    return res.json({ ok: true, scope, universeId, placeId, month: month || null, rows });
  } catch (e) {
    console.error("leaderboard exception:", e);
    return res.status(500).json({ ok: false, error: "server_exception" });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server running on", port));
