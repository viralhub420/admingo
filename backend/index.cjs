// index.cjs
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const { admin, db } = require("./firebase");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Telegram helper
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
async function sendTelegramMessage(telegramId, message) {
  if (!TELEGRAM_BOT_TOKEN || !telegramId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text: message })
    });
  } catch (e) {
    console.error("Telegram error:", e);
  }
}

/* =========================
   GET BALANCE
========================= */
app.get("/getBalance", async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) return res.json({ balance: 0 });

    const ref = db.collection("users").doc(String(telegramId));
    const doc = await ref.get();

    if (!doc.exists) {
      await ref.set({ balance: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      return res.json({ balance: 0 });
    }

    res.json({ balance: doc.data().balance || 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

/* =========================
   ADD COINS
========================= */
app.post("/addCoins", async (req, res) => {
  try {
    const { telegramId, amount } = req.body;
    if (!telegramId || !amount) return res.json({ success: false });

    const ref = db.collection("users").doc(String(telegramId));
    await ref.set({ balance: admin.firestore.FieldValue.increment(Number(amount)) }, { merge: true });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

/* =========================
   DAILY BONUS
========================= */
app.post("/dailyBonus", async (req, res) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) return res.json({ success: false });

    const ref = db.collection("users").doc(String(telegramId));
    const doc = await ref.get();

    const now = Date.now();
    const last = doc.data()?.dailyBonusAt || 0;

    if (now - last < 24 * 60 * 60 * 1000) {
      return res.json({ success: false, message: "Already claimed" });
    }

    await ref.set({
      balance: admin.firestore.FieldValue.increment(20),
      dailyBonusAt: now
    }, { merge: true });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

/* =========================
   REFERRAL AUTO VERIFY
========================= */
app.post("/referral", async (req, res) => {
  try {
    const { userId, referrerId } = req.body;
    if (!userId || !referrerId || userId === referrerId) return res.json({});

    const userRef = db.collection("users").doc(String(userId));
    const doc = await userRef.get();

    if (doc.exists && doc.data().referredBy) return res.json({}); // already referred

    await userRef.set({ referredBy: referrerId }, { merge: true });
    await db.collection("users").doc(String(referrerId)).set({
      balance: admin.firestore.FieldValue.increment(100)
    }, { merge: true });

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({});
  }
});

/* =========================
   WITHDRAW & ADMIN LOGIC
========================= */
app.post("/withdraw", async (req, res) => {
  try {
    const { telegramId, amount } = req.body;
    if (!telegramId || !amount) return res.json({ success: false });

    const ref = db.collection("users").doc(String(telegramId));
    await ref.set({ balance: admin.firestore.FieldValue.increment(-Number(amount)) }, { merge: true });

    // Send Telegram message
    await sendTelegramMessage(telegramId, `💰 Withdraw request received for ${amount} coins.`);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

// Serve index.html for frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ================= Render Port =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
