const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const router = express.Router();

const validateRegisterInput = (req, res, next) => {
  const { email, password } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters long" });
  }

  next();
};

router.post("/register", validateRegisterInput, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!name) return res.status(400).json({ error: "Name is required" });

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "email already exists" });
    }

    const [roleResult] = await pool.query(
      "SELECT id FROM roles WHERE name = 'USER'",
    );
    const roleId = roleResult[0].id;

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, roleId],
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    const [users] = await pool.query(
      "SELECT id, email, password, role_id FROM users WHERE email = ?",
      [email],
    );
    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const [roleResult] = await pool.query(
      "SELECT name FROM roles WHERE id = ?",
      [user.role_id],
    );

    if (roleResult.length === 0) {
      return res.status(500).json({ error: "Role not found" });
    }

    const role = roleResult[0].name;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: role },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: process.env.JWT_EXPIRY || "1h" },
    );

    res.status(200).json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
