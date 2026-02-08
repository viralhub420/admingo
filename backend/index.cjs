// index.cjs
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path"); // static serve এর জন্য

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔥 Firebase init
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

const db = admin.firestore();

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
      await ref.set({
        balance: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
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

    if (doc.exists && doc.data().referredBy) {
      return res.json({}); // already referred
    }

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
   WITHDRAW REQUEST
========================= */
app.post("/withdraw", async (req, res) => {
  try {
    const { telegramId, amount, method, number } = req.body;

    if (!telegramId || !amount || !method || !number) {
      return res.json({ success: false, message: "Missing fields" });
    }

    if (amount < 100) {
      return res.json({ success: false, message: "Minimum withdraw 100 coins" });
    }

    const userRef = db.collection("users").doc(String(telegramId));
    const userDoc = await userRef.get();

    if (!userDoc.exists || (userDoc.data().balance || 0) < amount) {
      return res.json({ success: false, message: "Insufficient balance" });
    }

    // deduct balance
    await userRef.update({
      balance: admin.firestore.FieldValue.increment(-amount)
    });

    // save withdraw request
    await db.collection("withdraws").add({
      telegramId,
      amount,
      method,
      number,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });

  } catch (e) {
    console.error(e);
    res.json({ success: false, message: "Server error" });
  }
});

/* =========================
   Serve index.html (root route)
========================= */
app.use(express.static(path.join(__dirname, "."))); // static files serve
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   Start Server
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
