require("dotenv").config();
const express = require("express");
const { testConnection } = require("./config/db");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const ticketRoutes = require("./routes/tickets");
const commentRoutes = require("./routes/comments");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ type: ["application/json", "text/plain"] }));

app.use((req, res, next) => {
  const authHeader =
    req.headers["authorization"] || req.headers["Authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret",
      );
      req.user = decoded;
    } catch (err) {}
  }
  next();
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/tickets", ticketRoutes);
app.use("/comments", commentRoutes);

app.get("/start", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();
