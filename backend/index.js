import express from "express";
import cors from "cors";

import userRoutes from "./user.js";
import adsRoutes from "./ads.js";
import withdrawRoutes from "./withdraw.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Admingo backend running 🚀");
});

app.use("/user", userRoutes);
app.use("/ads", adsRoutes);
app.use("/withdraw", withdrawRoutes);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
