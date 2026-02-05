import express from "express";
import { db } from "../firebase.js";

const router = express.Router();
const COOLDOWN = 60 * 1000; // 60 seconds cooldown

router.post("/watch", async (req, res) => {
  const { telegramId } = req.body;
  const ref = db.collection("users").doc(String(telegramId));
  const doc = await ref.get();

  if (!doc.exists) {
    return res.json({ error: "User not registered" });
  }

  const user = doc.data();

  if (Date.now() - user.lastAdTime < COOLDOWN) {
    const remaining = Math.ceil((COOLDOWN - (Date.now() - user.lastAdTime)) / 1000);
    return res.json({ error: `⏳ Cooldown active, wait ${remaining} sec` });
  }

  // Add reward
  const reward = 10; // points
  await ref.update({
    balance: user.balance + reward,
    lastAdTime: Date.now()
  });

  res.json({ success: true, reward });
});

export default router;
