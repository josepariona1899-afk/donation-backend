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
    if (req.get("X-Api-Key") !== API_KEY) return res.status(401).json({ ok: false });

    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);
    const scope = (req.query.scope || "global").toLowerCase();
    const month = req.query.month || null;

    let q = supabase
      .from("donations")
      .select("user_id, username, amount, ts, universe_id, place_id");

    if (month) {
      const start = `${month}-01T00:00:00Z`;
      const endDate = new Date(`${month}-01T00:00:00Z`);
      endDate.setUTCMonth(endDate.getUTCMonth() + 1);
      const end = endDate.toISOString();
      q = q.gte("ts", Math.floor(new Date(start).getTime() / 1000)).lt("ts", Math.floor(new Date(end).getTime() / 1000));
    }

    if (scope === "universe" && req.query.universeId) q = q.eq("universe_id", Number(req.query.universeId));
    if (scope === "place" && req.query.placeId) q = q.eq("place_id", Number(req.query.placeId));

    const { data, error } = await q;
    if (error) {
      console.error(error);
      return res.status(500).json({ ok: false });
    }

    const map = new Map();
    for (const row of data || []) {
      const id = Number(row.user_id);
      if (!id) continue;
      const cur = map.get(id) || { userId: id, username: row.username || "", amount: 0 };
      cur.amount += Number(row.amount || 0);
      if (!cur.username && row.username) cur.username = row.username;
      map.set(id, cur);
    }

    const rows = Array.from(map.values())
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
      .slice(0, limit);

    return res.json({ ok: true, rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server running on", port));
