const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔥 Firebase init
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "YOUR_PROJECT_ID",
    clientEmail: "YOUR_CLIENT_EMAIL",
    privateKey: "YOUR_PRIVATE_KEY".replace(/\\n/g, "\n")
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
    res.status(500).json({ error: "server error" });
  }
});

/* =========================
   ADD COINS (after ad)
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
  } catch {
    res.json({ success: false });
  }
});

/* =========================
   DAILY BONUS (1x per day)
========================= */
app.post("/dailyBonus", async (req, res) => {
  const { telegramId } = req.body;
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
});

/* =========================
   REFERRAL AUTO VERIFY
========================= */
app.post("/referral", async (req, res) => {
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
});

app.listen(3000, () => console.log("Server running"));
