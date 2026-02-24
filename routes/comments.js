const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");

const checkRole = (roles) => (req, res, next) => {
  const userRole = req.user?.role;
  if (!roles.includes(userRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

router.patch("/:id", async (req, res) => {
  try {
    let { id } = req.params;
    id = id.replace(":", "");
    const { comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!comment) return res.status(400).json({ error: "Comment is required" });

    const [existing] = await pool.query(
      "SELECT user_id FROM ticket_comments WHERE id = ?",
      [id],
    );
    if (existing.length === 0)
      return res.status(404).json({ error: "Comment not found" });

    if (userRole !== "MANAGER" && existing[0].user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Forbidden: Not the author and not a MANAGER" });
    }

    await pool.query("UPDATE ticket_comments SET comment = ? WHERE id = ?", [
      comment,
      id,
    ]);
    res.status(200).json({ message: "Comment updated successfully" });
  } catch (err) {
    console.error("Error updating comment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    let { id } = req.params;
    id = id.replace(":", "");
    const userId = req.user.id;
    const userRole = req.user.role;

    const [existing] = await pool.query(
      "SELECT user_id FROM ticket_comments WHERE id = ?",
      [id],
    );
    if (existing.length === 0)
      return res.status(404).json({ error: "Comment not found" });

    if (userRole !== "MANAGER" && existing[0].user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Forbidden: Not the author and not a MANAGER" });
    }

    await pool.query("DELETE FROM ticket_comments WHERE id = ?", [id]);
    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
