// routes/assets.js

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const pool = require("../db/db");
const authenticateToken = require("../middleware/auth");

require("dotenv").config();

const router = express.Router();

// ✅ Configure AWS S3 client (SDK v3)
const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ✅ Multer setup (store file temporarily before S3 upload)
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
    }
    cb(null, true);
  },
});

// ✅ Upload to S3
router.post("/upload", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const { filename, mimetype, path: filepath, size } = req.file;
    const uploaderId = req.user.id;

    // Tags (optional)
    let tags = null;
    if (req.body.tags) {
      try {
        tags = JSON.parse(req.body.tags);
      } catch {
        tags = req.body.tags.split(",").map(t => t.trim()).filter(Boolean);
      }
    }

    // Permissions (default private)
    let permissions = { public: false };
    if (req.body.permissions) {
      try {
        permissions = JSON.parse(req.body.permissions);
      } catch {
        if (req.body.permissions === "public") permissions.public = true;
      }
    }

    // Upload file to S3
    const fileStream = fs.createReadStream(filepath);
    const s3Key = `uploads/${Date.now()}-${filename}`;
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: fileStream,
      ContentType: mimetype,
      ACL: permissions.public ? "public-read" : "private",
    };

    const parallelUpload = new Upload({
      client: s3,
      params: uploadParams,
    });

    await parallelUpload.done();

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Remove local file after upload
    fs.unlinkSync(filepath);

    // Save record in DB
    const result = await pool.query(
      `INSERT INTO assets 
        (filename, filepath, mimetype, uploader_id, size, tags, permissions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        filename,
        fileUrl,
        mimetype,
        uploaderId,
        size,
        tags ? JSON.stringify(tags) : null,
        JSON.stringify(permissions),
      ]
    );

    res.json({
      message: "✅ File uploaded successfully to S3",
      asset: result.rows[0],
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: error.message || "Error uploading file" });
  }
});

// ✅ Fetch user’s files
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      "SELECT * FROM assets WHERE uploader_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching assets:", error);
    res.status(500).json({ message: "Error fetching assets" });
  }
});

// ✅ Delete file from S3 + DB
router.delete("/:filename", authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      "DELETE FROM assets WHERE filename = $1 AND uploader_id = $2 RETURNING *",
      [filename, userId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "File not found or not owned by user" });

    const deletedFile = result.rows[0];
    const fileUrl = deletedFile.filepath;
    const key = fileUrl.split(".amazonaws.com/")[1];

    // Delete from S3
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }));

    res.json({ message: "🗑️ File deleted successfully from S3" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: "Error deleting file" });
  }
});

// ✅ User analytics route
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT 
         COUNT(*) AS total_files,
         COALESCE(SUM(size), 0) AS total_storage_bytes
       FROM assets
       WHERE uploader_id = $1;`,
      [userId]
    );
    res.json({
      total_files: result.rows[0].total_files,
      total_storage_bytes: result.rows[0].total_storage_bytes,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Error fetching user stats" });
  }
});
// ✅ Get file info (or public S3 URL) by filename
router.get("/:filename", authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT * FROM assets WHERE filename = $1 AND uploader_id = $2",
      [filename, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    const file = result.rows[0];
    res.json({
      message: "✅ File found",
      file,
      s3_url: file.filepath, // Direct link to file in S3
    });
  } catch (error) {
    console.error("Error fetching file info:", error);
    res.status(500).json({ message: "Error fetching file info" });
  }
});
// ✅ Get file info (or public S3 URL) by filename
router.get("/:filename", authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT * FROM assets WHERE filename = $1 AND uploader_id = $2",
      [filename, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "File not found or not owned by user" });
    }

    const file = result.rows[0];
    res.json({
      message: "✅ File found",
      file,
      s3_url: file.filepath, // Direct link to file in S3
    });
  } catch (error) {
    console.error("Error fetching file info:", error);
    res.status(500).json({ message: "Error fetching file info" });
  }
});

module.exports = router;
