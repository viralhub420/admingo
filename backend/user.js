import express from "express";
import { db } from "./firebase.js"; // <-- ঠিক path

const router = express.Router();

router.post("/register", async (req, res) => {
  const { telegramId, username } = req.body;

  const ref = db.collection("users").doc(String(telegramId));
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
      username,
      balance: 0,
      lastAdTime: 0,
      createdAt: Date.now()
    });
  }

  res.json({ success: true });
});

export default router;
