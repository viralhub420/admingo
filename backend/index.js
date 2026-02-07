// backend/index.js

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");

// Firebase service account
const serviceAccount = require("./firebaseServiceAccount.json");

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Default route
app.get("/", (req, res) => {
  res.send("Admingo backend running 🚀");
});

// Register user route
app.post("/register", async (req, res) => {
  try {
    const { id, first_name, username, balance } = req.body;

    if (!id) return res.status(400).json({ error: "Missing ID" });

    const docRef = db.collection("users").doc(id.toString());

    await docRef.set({
      first_name,
      username,
      balance: balance || 0,
      lastUpdated: Date.now()
    });

    res.json({ success: true, message: "User saved to Firestore" });

  } catch (err) {
    console.error("Error saving user:", err);
    res.status(500).json({ error: "Failed to save user" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
