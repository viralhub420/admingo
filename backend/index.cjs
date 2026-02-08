// index.cjs
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path"); // static serve এর জন্য
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // Telegram message

// Helper imports
const { initFirebase } = require("./firebase");
const { getBalance, addCoins } = require("./user");
const { requestWithdraw, refundWithdraw } = require("./withdraw");
const { showAd } = require("./ads");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname))); // index.html serve

// Firebase init
const db = initFirebase();

// Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const sendTelegramMessage = async (chatId, message) => {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  } catch (e) {
    console.error("Telegram message error:", e);
  }
};

/* =========================
   GET BALANCE
========================= */
app.get("/getBalance", async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) return res.json({ balance: 0 });
    const balance = await getBalance(telegramId);
    res.json({ balance });
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
    addCoins(telegramId, Number(amount));
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

    const userRef = db.collection("users").doc(String(telegramId));
    const doc = await userRef.get();

    const now = Date.now();
    const last = doc.data()?.dailyBonusAt || 0;

    if (now - last < 24 * 60 * 60 * 1000) {
      return res.json({ success: false, message: "Already claimed" });
    }

    await userRef.set({
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
   REFERRAL
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
   WITHDRAW
========================= */
app.post("/withdraw", async (req, res) => {
  try {
    const { telegramId, amount, method, number } = req.body;
    if (!telegramId || !amount || !method || !number) return res.json({ success:false });
    const id = await requestWithdraw(telegramId, amount, method, number);
    res.json({ success: true, withdrawId: id });
  } catch(e) {
    console.error(e);
    res.json({ success:false });
  }
});

/* =========================
   ADMIN APPROVE / REJECT
========================= */
app.post("/admin/withdraws", async (req, res) => {
  try {
    const { withdrawId, action } = req.body; // action = 'approve' / 'reject'
    if (!withdrawId || !action) return res.json({ success:false });

    const wRef = db.collection("withdraws").doc(String(withdrawId));
    const doc = await wRef.get();
    if (!doc.exists) return res.json({ success:false });

    const { telegramId, amount } = doc.data();

    if (action === "approve") {
      await wRef.set({ status:"approved" }, { merge:true });
      await sendTelegramMessage(telegramId, `✅ Your withdraw of ${amount} has been approved!`);
    } else if (action === "reject") {
      await wRef.set({ status:"rejected" }, { merge:true });
      await refundWithdraw(telegramId, amount);
      await sendTelegramMessage(telegramId, `❌ Your withdraw of ${amount} has been rejected and refunded!`);
    }

    res.json({ success:true });
  } catch(e) {
    console.error(e);
    res.json({ success:false });
  }
});

// ================= Render Port =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
