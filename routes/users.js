const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");

const router = express.Router();

const checkRole = (roles) => (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "default-secret",
    );

    req.user = decoded;

    const userRole = req.user?.role;
    if (!userRole) {
      return res
        .status(403)
        .json({ error: "Forbidden: Role not found in token" });
    }

    if (!roles.includes(userRole)) {
      console.log(
        `User role '${userRole}' does not have access to this route.`,
      );
      return res.status(403).json({ error: "Forbidden: Insufficient role" });
    }

    next();
  } catch (err) {
    console.error("Authorization error:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

router.post("/", checkRole(["MANAGER"]), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const [roleResult] = await pool.query(
      "SELECT id FROM roles WHERE name = ?",
      [role],
    );
    if (roleResult.length === 0) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const roleId = roleResult[0].id;

    const [existingUser] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, roleId],
    );

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", checkRole(["MANAGER"]), async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT users.id, users.name, users.email, roles.name AS role, users.created_at 
       FROM users 
       JOIN roles ON users.role_id = roles.id`,
    );

    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
