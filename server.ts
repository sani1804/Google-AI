import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import multer from "multer";
import pdf from "pdf-parse";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route for parsing files (PDF, Text)
  app.post("/api/parse-file", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`Parsing file: ${req.file.originalname} (${req.file.mimetype})`);

      let text = "";
      if (req.file.mimetype === "application/pdf") {
        const data = await pdf(req.file.buffer);
        text = data.text;
      } else if (req.file.mimetype.startsWith("text/")) {
        text = req.file.buffer.toString("utf-8");
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload PDF or Text files." });
      }

      res.json({ text, success: true });
    } catch (error: any) {
      console.error("File parsing error:", error.message);
      res.status(500).json({ error: "Failed to parse file." });
    }
  });

  // API Route for scraping job details
  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`Scraping: ${url}`);
      // Using a standard User-Agent and common headers to avoid immediate blocks
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.google.com/",
          "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "cross-site",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Simple extraction logic
      const title = $("title").text() || $("h1").first().text();
      
      // Clean tags to get readable text
      $("script, style, nav, footer, header").remove();
      const content = $("body").text().replace(/\s\s+/g, " ").trim().substring(0, 5000);

      res.json({
        title: title.trim(),
        content: content,
        success: true
      });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      
      if (error.response?.status === 999) {
        return res.status(403).json({ 
          error: "ACCESS_DENIED",
          message: "The website (likely LinkedIn) blocked the scraping request. Please copy and paste the job description manually." 
        });
      }

      res.status(500).json({ 
        error: "SCRAPE_FAILED",
        message: "Failed to extract details from URL. The site might be protected or unreachable." 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
