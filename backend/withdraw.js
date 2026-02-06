import express from "express";
import { db } from "./firebase.js"; // <-- ঠিক path

const router = express.Router();

router.post("/request", async (req, res) => {
  const { telegramId, method, amount } = req.body;

  const ref = db.collection("users").doc(String(telegramId));
  const doc = await ref.get();

  if (!doc.exists) {
    return res.json({ success: false, error: "User not found" });
  }

  const userData = doc.data();

  if (userData.balance < amount) {
    return res.json({ success: false, error: "Insufficient balance" });
  }

  await ref.update({
    balance: userData.balance - amount
  });

  // Withdraw request record (optional)
  await db.collection("withdrawals").add({
    telegramId,
    method,
    amount,
    createdAt: Date.now()
  });

  res.json({ success: true, message: "Withdraw request submitted" });
});

export default router;
