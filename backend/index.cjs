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

// Environment Variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; // <--- রেন্ডার থেকে আইডিটি এখানে আসবে

// Telegram helper (ইউজার এবং অ্যাডমিনকে মেসেজ দেওয়ার জন্য)
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
   USER: GET BALANCE
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
   USER: ADD COINS
========================= */
app.post("/addCoins", async (req, res) => {
  try {
    const { telegramId, amount } = req.body;
    if (!telegramId || !amount) return res.json({ success: false });

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
   USER: DAILY BONUS 
========================= */
app.post("/dailyBonus", async (req, res) => {
  try {
    const { telegramId } = req.body;
    const userRef = db.collection("users").doc(String(telegramId));
    const doc = await userRef.get();
    
    if (!doc.exists) return res.json({ success: false, message: "User not found" });

    const lastDaily = doc.data()?.lastDaily?.toDate() || new Date(0);
    const now = new Date();
    
    // ২৪ ঘণ্টা চেক
    if (now - lastDaily < 24 * 60 * 60 * 1000) {
      const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - (now - lastDaily)) / (3600000));
      return res.json({ success: false, message: `আবার ${remainingHours} ঘণ্টা পর চেষ্টা করুন।` });
    }

    await userRef.update({
      balance: admin.firestore.FieldValue.increment(10),
      lastDaily: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

/* =========================
   USER: WITHDRAW REQUEST
========================= */
app.post("/withdraw", async (req, res) => {
  try {
    const { telegramId, amount, method, number } = req.body;
    if (!telegramId || !amount || amount <= 0) return res.json({ success: false });

    const ref = db.collection("users").doc(String(telegramId));
    const doc = await ref.get();
    const balance = doc.data()?.balance || 0;

    if (balance < Number(amount)) {
      return res.json({ success: false, message: "Insufficient balance" });
    }

    await ref.update({ balance: admin.firestore.FieldValue.increment(-Number(amount)) });

    await db.collection("withdraws").add({
      telegramId: String(telegramId),
      amount: Number(amount),
      method,
      number,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ১. ইউজারকে কনফার্মেশন মেসেজ
    await sendTelegramMessage(telegramId, `💰 Withdraw request for ${amount} coins received.`);

    // ২. অ্যাডমিনকে (আপনাকে) নোটিফিকেশন পাঠানো <--- নতুন অ্যাড করা হয়েছে
    if (ADMIN_ID) {
      await sendTelegramMessage(ADMIN_ID, `🔔 নতুন উইথড্র রিকোয়েস্ট!\nইউজার আইডি: ${telegramId}\nপরিমাণ: ${amount}\nমেথড: ${method}\nনম্বর: ${number}`);
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

/* =========================
   ADMIN: GET PENDING WITHDRAWS
========================= */
app.get("/admin/withdraws", async (req, res) => {
  try {
    const snapshot = await db.collection("withdraws").where("status", "==", "pending").get();
    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });
    res.json(list);
  } catch (e) {
    res.status(500).send(e);
  }
});

/* =========================
   ADMIN: APPROVE/REJECT ACTION
========================= */
app.post("/admin/withdraw-action", async (req, res) => {
  try {
    const { withdrawId, action } = req.body;
    const ref = db.collection("withdraws").doc(withdrawId);
    const withdrawDoc = await ref.get();
    
    if (!withdrawDoc.exists) return res.json({ success: false });

    const { telegramId, amount } = withdrawDoc.data();

    if (action === "approve") {
      await ref.update({ status: "approved" });
      await sendTelegramMessage(telegramId, `✅ Your withdraw of ${amount} coins has been approved!`);
    } else {
      const userRef = db.collection("users").doc(String(telegramId));
      await userRef.update({
        balance: admin.firestore.FieldValue.increment(Number(amount))
      });
      await ref.update({ status: "rejected" });
      await sendTelegramMessage(telegramId, `❌ Your withdraw request was rejected. Coins refunded.`);
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin-panel", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
      
