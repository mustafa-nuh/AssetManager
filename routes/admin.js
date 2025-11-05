// routes/admin.js
const express = require("express");
const router = express.Router();
const pool = require("../db/db");
const authenticateToken = require("../middleware/auth");
const { requireRole } = require("../middleware/role");
const path = require("path");
const fs = require("fs");

// ===============================================
// 🔐 Admin Access Routes
// ===============================================

// ✅ 1️⃣ List all users (admin)
router.get("/users", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, created_at FROM users ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// ✅ 2️⃣ List all assets (admin)
router.get("/assets", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const q = await pool.query("SELECT * FROM assets ORDER BY created_at DESC");
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching assets" });
  }
});

// ✅ 3️⃣ Admin delete any asset by filename
router.delete("/assets/:filename", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const { filename } = req.params;
    const r = await pool.query("DELETE FROM assets WHERE filename = $1 RETURNING *", [filename]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Asset not found" });

    // remove file from filesystem if present
    const filepath = r.rows[0].filepath;
    if (filepath && fs.existsSync(filepath)) fs.unlinkSync(filepath);

    res.json({ message: "Asset deleted by admin", asset: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting asset" });
  }
});

// ===============================================
// 📊 Analytics / Stats Endpoints
// ===============================================

// ✅ 4️⃣ Total number of users
router.get("/stats/users", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) AS total_users FROM users");
    res.json({ total_users: result.rows[0].total_users });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Error fetching user stats" });
  }
});

// ✅ 5️⃣ Total number of assets
router.get("/stats/assets", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) AS total_assets FROM assets");
    res.json({ total_assets: result.rows[0].total_assets });
  } catch (error) {
    console.error("Error fetching asset stats:", error);
    res.status(500).json({ message: "Error fetching asset stats" });
  }
});

// ✅ 6️⃣ Storage used per user
router.get("/stats/storage", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, 
             COALESCE(SUM(a.size), 0) AS total_storage_bytes
      FROM users u
      LEFT JOIN assets a ON u.id = a.uploader_id
      GROUP BY u.id, u.name, u.email
      ORDER BY total_storage_bytes DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching storage stats:", error);
    res.status(500).json({ message: "Error fetching storage stats" });
  }
});

// ✅ 7️⃣ Public vs Private assets count
router.get("/stats/visibility", authenticateToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        SUM((permissions ->> 'public')::boolean::int) AS public_files,
        COUNT(*) - SUM((permissions ->> 'public')::boolean::int) AS private_files
      FROM assets;
    `);
    res.json({
      public_files: result.rows[0].public_files || 0,
      private_files: result.rows[0].private_files || 0
    });
  } catch (error) {
    console.error("Error fetching visibility stats:", error);
    res.status(500).json({ message: "Error fetching visibility stats" });
  }
});

module.exports = router;

