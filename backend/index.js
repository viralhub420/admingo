import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ES module path fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// middleware
app.use(express.json());

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
