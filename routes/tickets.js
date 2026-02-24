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

router.post("/", checkRole(["USER", "MANAGER"]), async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const userId = req.user.id;

    if (!title || title.length < 5) {
      return res
        .status(400)
        .json({ error: "Title must be at least 5 characters" });
    }
    if (!description || description.length < 10) {
      return res
        .status(400)
        .json({ error: "Description must be at least 10 characters" });
    }
    const validPriorities = ["LOW", "MEDIUM", "HIGH"];
    if (priority && !validPriorities.includes(priority.toUpperCase())) {
      return res.status(400).json({ error: "Invalid priority" });
    }
    const [result] = await pool.query(
      "INSERT INTO tickets (title, description, priority, created_by) VALUES (?, ?, ?, ?)",
      [title, description, priority || "MEDIUM", userId],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "Ticket created successfully" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userRole) return res.status(401).json({ error: "Unauthorized" });

    let query = `
      SELECT t.*, u.name as creator_name, a.name as assigned_name
      FROM tickets t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
    `;
    let params = [];

    if (userRole === "MANAGER") {
    } else if (userRole === "SUPPORT") {
      query += " WHERE t.assigned_to = ?";
      params.push(userId);
    } else if (userRole === "USER") {
      query += " WHERE t.created_by = ?";
      params.push(userId);
    } else {
      return res.status(403).json({ error: "Forbidden: Unknown role" });
    }

    const [tickets] = await pool.query(query, params);
    res.status(200).json(tickets);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch(
  "/:id/assign",
  checkRole(["MANAGER", "SUPPORT"]),
  async (req, res) => {
    try {
      let { id } = req.params;
      id = id.replace(":", "");
      const { userId } = req.body;

      if (!userId) return res.status(400).json({ error: "userId is required" });

      const [user] = await pool.query(
        "SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
        [userId],
      );

      if (user.length === 0 || user[0].name === "USER") {
        return res
          .status(400)
          .json({ error: "Tickets cannot be assigned to regular users" });
      }

      await pool.query("UPDATE tickets SET assigned_to = ? WHERE id = ?", [
        userId,
        id,
      ]);
      res.status(200).json({ message: "Ticket assigned successfully" });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.patch(
  "/:id/status",
  checkRole(["MANAGER", "SUPPORT"]),
  async (req, res) => {
    const connection = await pool.getConnection();
    try {
      let { id } = req.params;
      id = id.replace(":", "");
      const { status } = req.body;
      const changedBy = req.user.id;

      if (!status) return res.status(400).json({ error: "Status is required" });

      const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
      const newStatus = status.toUpperCase();
      if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      await connection.beginTransaction();

      const [ticket] = await connection.query(
        "SELECT status FROM tickets WHERE id = ?",
        [id],
      );
      if (ticket.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Ticket not found" });
      }

      const oldStatus = ticket[0].status;
      const statusOrder = { OPEN: 1, IN_PROGRESS: 2, RESOLVED: 3, CLOSED: 4 };

      if (statusOrder[newStatus] !== statusOrder[oldStatus] + 1) {
        await connection.rollback();
        return res.status(400).json({
          error: `Invalid transition: ${oldStatus} -> ${newStatus}. Transitions must be sequential.`,
        });
      }

      await connection.query("UPDATE tickets SET status = ? WHERE id = ?", [
        newStatus,
        id,
      ]);
      await connection.query(
        "INSERT INTO ticket_status_logs (ticket_id, old_status, new_status, changed_by) VALUES (?, ?, ?, ?)",
        [id, oldStatus, newStatus, changedBy],
      );

      await connection.commit();
      res.status(200).json({ message: `Status updated to ${newStatus}` });
    } catch (err) {
      await connection.rollback();
      res.status(500).json({ error: "Internal server error" });
    } finally {
      connection.release();
    }
  },
);

router.delete("/:id", checkRole(["MANAGER"]), async (req, res) => {
  try {
    let { id } = req.params;
    id = id.replace(":", "");
    const [result] = await pool.query("DELETE FROM tickets WHERE id = ?", [id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Ticket not found" });
    res.status(200).json({ message: "Ticket deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Internal server error", message: err.message });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    let { id } = req.params;
    id = id.replace(":", "");
    const { comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!comment) return res.status(400).json({ error: "Comment is required" });

    const [ticket] = await pool.query(
      "SELECT created_by, assigned_to FROM tickets WHERE id = ?",
      [id],
    );
    if (ticket.length === 0)
      return res.status(404).json({ error: "Ticket not found" });

    const isOwner = ticket[0].created_by === userId;
    const isAssigned = ticket[0].assigned_to === userId;

    if (userRole !== "MANAGER" && !isOwner && !isAssigned) {
      return res
        .status(403)
        .json({ error: "Forbidden: Not authorized to comment on this ticket" });
    }

    await pool.query(
      "INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES (?, ?, ?)",
      [id, userId, comment],
    );
    res.status(201).json({ message: "Comment added successfully" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/comments", async (req, res) => {
  try {
    let { id } = req.params;
    id = id.replace(":", "");
    const userId = req.user.id;
    const userRole = req.user.role;

    const [ticket] = await pool.query(
      "SELECT created_by, assigned_to FROM tickets WHERE id = ?",
      [id],
    );
    if (ticket.length === 0)
      return res.status(404).json({ error: "Ticket not found" });

    const isOwner = ticket[0].created_by === userId;
    const isAssigned = ticket[0].assigned_to === userId;

    if (userRole !== "MANAGER" && !isOwner && !isAssigned) {
      return res.status(403).json({
        error: "Forbidden: Not authorized to view comments for this ticket",
      });
    }

    const [comments] = await pool.query(
      `SELECT tc.*, u.name as user_name 
       FROM ticket_comments tc 
       JOIN users u ON tc.user_id = u.id 
       WHERE tc.ticket_id = ? 
       ORDER BY tc.created_at DESC`,
      [id],
    );
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
