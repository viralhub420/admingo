import express from "express";
import { db } from "../firebase.js";

const router = express.Router();

// Minimum withdraw amount
const MIN_WITHDRAW = 100;

router.post("/request", async (req, res) => {
  const { telegramId, method, amount } = req.body;

  if (!["bKash", "Nagad", "USDT"].includes(method)) {
    return res.json({ error: "Invalid withdraw method" });
  }

  if (amount < MIN_WITHDRAW) {
    return res.json({ error: `Minimum withdraw is ${MIN_WITHDRAW} points` });
  }

  const ref = db.collection("users").doc(String(telegramId));
  const doc = await ref.get();

  if (!doc.exists) return res.json({ error: "User not registered" });

  const user = doc.data();

  if (user.balance < amount) {
    return res.json({ error: "Insufficient balance" });
  }

  // Deduct balance
  await ref.update({ balance: user.balance - amount });

  // Create withdraw request
  await db.collection("withdraws").add({
    userId: telegramId,
    method,
    amount,
    status: "pending",
    requestedAt: Date.now()
  });

  res.json({ success: true, message: "Withdraw request submitted" });
});

export default router;
