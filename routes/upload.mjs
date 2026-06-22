import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import axios from "axios";
import FormData from "form-data";
import { authenticateAdmin } from "../middleware/auth.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pehle server/.env padho (priority zyada), phir root .env
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

const router = express.Router();

// Use memory storage instead of local disk storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB global limit
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    // Check file
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded",
      });
    }

    const isGif = req.file.mimetype === "image/gif";

    const imageLimit = isGif ? 20 * 1024 * 1024 : 5 * 1024 * 1024;

    if (req.file.mimetype.startsWith("image/") && req.file.size > imageLimit) {
      return res.status(400).json({
        error: `Image exceeds ${isGif ? "20MB" : "5MB"} limit`,
      });
    }

    // ✅ Enforce 50MB limit for PDFs
    if (
      req.file.mimetype === "application/pdf" &&
      req.file.size > 50 * 1024 * 1024
    ) {
      return res.status(400).json({
        error: "PDF file size exceeds 50MB limit.",
      });
    }

    // ✅ Enforce 15MB limit for Videos
    if (
      req.file.mimetype.startsWith("video/") &&
      req.file.size > 15 * 1024 * 1024
    ) {
      return res.status(400).json({
        error: "Video file size exceeds 15MB limit.",
      });
    }

    // ✅ Folder support
    const folder = req.body.folder || "misc";

    // If not uploading to career, require admin authentication
    if (folder !== "career") {
      let isAuthenticated = false;
      await new Promise((resolve) => {
        authenticateAdmin(req, res, () => {
          isAuthenticated = true;
          resolve();
        });
      });
      if (!isAuthenticated) return;
    }

    // ✅ File extension
    const ext = path.extname(req.file.originalname);

    // ✅ Random string
    const randomString = Math.random().toString(36).substring(2, 10);

    // ✅ Final filename
    const filename = `${folder}_${Date.now()}${randomString}${ext}`;

    // ✅ Create form data
    const formData = new FormData();

    // ✅ Send folder also (MUST be before file for multer)
    formData.append("folder", folder);

    formData.append("file", req.file.buffer, filename);

    // ✅ Check if folder is for local save only, or fallback if central API is not configured
    const localOnlyFolders = ["registrar", "bankers", "complogo"];
    const isLocalOnly = localOnlyFolders.includes(folder);

    if (isLocalOnly || !process.env.UPLOAD_API_URL) {
      const uploadDir = process.env.UPLOADS_PATH || "./uploads";
      const resolvedUploadsPath = path.resolve(__dirname, "..", uploadDir);
      const dynamicDir = path.join(resolvedUploadsPath, folder);

      try {
        await fs.mkdir(dynamicDir, { recursive: true });
      } catch (e) {
        console.error("Local folder creation error:", e);
      }

      const filePath = path.join(dynamicDir, filename);
      await fs.writeFile(filePath, req.file.buffer);

      return res.json({
        url: `/uploads/${folder}/${filename}`,
      });
    }

    try {
      // ✅ Upload to central upload API
      const uploadUrl = new URL(process.env.UPLOAD_API_URL);
      uploadUrl.searchParams.append("folder", folder);

      const response = await axios.post(uploadUrl.toString(), formData, {
        headers: {
          ...formData.getHeaders(),
          "x-api-key": process.env.UPLOAD_API_KEY,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      // ✅ Return uploaded URL
      return res.json({
        url: response.data.url,
      });
    } catch (apiErr) {
      console.error("Central API upload failed, falling back to local save:", apiErr?.response?.data || apiErr.message);

      // Local save fallback
      const uploadDir = process.env.UPLOADS_PATH || "./uploads";
      const resolvedUploadsPath = path.resolve(__dirname, "..", uploadDir);
      const dynamicDir = path.join(resolvedUploadsPath, folder);

      try {
        await fs.mkdir(dynamicDir, { recursive: true });
      } catch (e) {
        console.error("Local folder creation error in fallback:", e);
      }

      const filePath = path.join(dynamicDir, filename);
      await fs.writeFile(filePath, req.file.buffer);

      return res.json({
        url: `/uploads/${folder}/${filename}`,
      });
    }
  } catch (err) {
    console.error("Upload Error:", err?.response?.data || err.message);

    return res.status(500).json({
      error: "Upload failed",
      details: err?.response?.data || err.message,
    });
  }
});

export default router;
