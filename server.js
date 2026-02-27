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

app.post("/roblox/donation", async (req, res) => {
  try {
    if (req.get("X-Api-Key") !== API_KEY) {
      return res.status(401).json({ ok: false });
    }

    const d = req.body;

    const { error } = await supabase
      .from("donations")
      .insert({
        receipt_id: d.receiptId,
        user_id: d.userId,
        username: d.username,
        amount: d.amount,
        product_id: d.productId,
        place_id: d.placeId,
        universe_id: d.universeId,
        job_id: d.jobId,
        ts: d.ts
      });

    if (error) {
      console.error(error);
      return res.status(500).json({ ok: false });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on", port));
