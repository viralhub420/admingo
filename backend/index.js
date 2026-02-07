import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Import user route
import userRoutes from "./user.js";  // নিশ্চিত হও user.js same folder এ আছে

const app = express();
const PORT = process.env.PORT || 3000;

// ES module path fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// middleware
app.use(express.json());

// Register route
app.use("/", userRoutes);  // /register POST route enable

// Mini App serve
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// test route
app.get("/health", (req, res) => {
  res.send("Admingo backend running 🚀");
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
