import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import userRoutes from './user.js'
import adsRoutes from './ads.js'
import withdrawRoutes from './withdraw.js'

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/user", userRoutes);
app.use("/ads", adsRoutes);
app.use("/withdraw", withdrawRoutes);

app.get("/", (req, res) => {
  res.send("🔥 Admingo Backend Running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
