// server.js

const express = require("express");
const app = express();
const pool = require("./db/db");
const authRoutes = require("./routes/auth");
const assetRoutes = require("./routes/assets");
const adminRoutes = require("./routes/admin"); // ✅ Added admin routes
const authenticateToken = require("./middleware/auth");
require("dotenv").config();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/assets", assetRoutes);
app.use("/admin", adminRoutes); // ✅ Admin routes connected

// ✅ Root route for testing connection
app.get("/", (req, res) => {
  res.send("✅ Server is live and running on AWS EC2!");
});

// ✅ Protected route (requires valid JWT)
app.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json({
      message: "Protected route accessed successfully",
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

// Start the server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

