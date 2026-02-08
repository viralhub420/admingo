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
   GET BALANCE (ফিক্সড: নতুন ইউজার হ্যান্ডলিং)
========================= */
app.get("/getBalance", async (req, res) => {
  try {
    const { telegramId } = req.query;
    if (!telegramId) return res.json({ balance: 0 });

    const ref = db.collection("users").doc(String(telegramId));
    const doc = await ref.get();

    if (!doc.exists) {
      const newUser = { 
        balance: 0, 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      };
      await ref.set(newUser);
      return res.json({ balance: 0 });
    }

    res.json({ balance: doc.data().balance || 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

/* =========================
   ADD COINS (ফিক্সড: Number conversion)
========================= */
app.post("/addCoins", async (req, res) => {
  try {
    const { telegramId, amount } = req.body;
    if (!telegramId || isNaN(amount)) return res.json({ success: false });

    const ref = db.collection("users").doc(String(telegramId));
    await ref.set({ 
      balance: admin.firestore.FieldValue.increment(Number(amount)) 
    }, { merge: true });
    
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

/* =========================
   WITHDRAW (ফিক্সড: ব্যালেন্স চেক এবং সিকিউরিটি)
========================= */
app.post("/withdraw", async (req, res) => {
  try {
    const { telegramId, amount, method, number } = req.body;
    
    if (!telegramId || !amount || Number(amount) <= 0) {
      return res.json({ success: false, message: "Invalid amount" });
    }

    const ref = db.collection("users").doc(String(telegramId));
    const doc = await ref.get();

    if (!doc.exists) return res.json({ success: false, message: "User not found" });

    const currentBalance = doc.data().balance || 0;

    // চেক: পর্যাপ্ত ব্যালেন্স আছে কি না
    if (currentBalance < Number(amount)) {
      return res.json({ success: false, message: "Insufficient Balance!" });
    }

    // ব্যালেন্স বিয়োগ করা
    await ref.update({
      balance: admin.firestore.FieldValue.increment(-Number(amount))
    });

    // উইথড্র রেকর্ড ডাটাবেসে সেভ করা
    await db.collection("withdraws").add({
      telegramId: String(telegramId),
      amount: Number(amount),
      method: method || "Unknown",
      number: number || "N/A",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // টেলিগ্রাম নোটিফিকেশন পাঠানো
    await sendTelegramMessage(telegramId, `💰 Withdraw request for ${amount} coins is pending! Method: ${method}`);

    res.json({ success: true });
  } catch (e) {
    console.error("Withdraw error:", e);
    res.json({ success: false, message: "Internal server error" });
  }
});

/* =========================
   অন্যান্য ফাংশন (ডেইলি বোনাস ও রেফারাল)
========================= */
app.post("/dailyBonus", async (req, res) => {
  try {
    const { telegramId } = req.body;
    const ref = db.collection("users").doc(String(telegramId));
    const doc = await ref.get();

    const now = Date.now();
    const last = doc.data()?.dailyBonusAt || 0;

    if (now - last < 24 * 60 * 60 * 1000) {
      return res.json({ success: false, message: "Wait 24 hours" });
    }

    await ref.set({
      balance: admin.FieldValue.increment(20),
      dailyBonusAt: now
    }, { merge: true });

    res.json({ success: true });
  } catch (e) { res.json({ success: false }); }
});

// Serve Frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
      
