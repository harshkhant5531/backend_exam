const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "harsh@5531",
  database: process.env.DB_NAME || "backend_error",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(
      `Connected to database: ${process.env.DB_NAME || "backend_error"}`,
    );
    connection.release();
    return true;
  } catch (err) {
    console.error("Database connection failed:", err.message);
    throw err;
  }
}
testConnection();
module.exports = { pool, testConnection };
