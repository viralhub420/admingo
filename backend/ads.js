import express from "express";
import { db } from "./firebase.js"; // <-- ঠিক path

const router = express.Router();

const REWARD_POINTS = 10;
const COOLDOWN = 60; // seconds

router.post("/watch", async (req, res) => {
  const { telegramId } = req.body;

  const ref = db.collection("users").doc(String(telegramId));
  const doc = await ref.get();

  if (!doc.exists) {
    return res.json({ success: false, error: "User not found" });
  }

  const userData = doc.data();
  const now = Math.floor(Date.now() / 1000);

  if (now - userData.lastAdTime < COOLDOWN) {
    return res.json({ success: false, error: `Please wait ${COOLDOWN} seconds between ads.` });
  }

  await ref.update({
    balance: userData.balance + REWARD_POINTS,
    lastAdTime: now
  });

  res.json({ success: true, reward: REWARD_POINTS });
});

export default router;
