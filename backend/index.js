import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import bodyParser from "body-parser";
import serviceAccount from "./firebaseServiceAccount.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
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
    await docRef.set({ first_name, username, balance });

    res.json({ success: true, message: "User saved to Firestore" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save user" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
