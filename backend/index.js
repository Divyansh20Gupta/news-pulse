// src/index.js — Express entry point
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");

const clustersRouter = require("./clusters");
const timelineRouter = require("./timeline");
const ingestRouter   = require("./ingest");

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
}));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/clusters", clustersRouter);
app.use("/timeline", timelineRouter);
app.use("/ingest",   ingestRouter);

// Health check — useful for Railway/Render cold-start detection
app.get("/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// 404 catch-all
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`News Pulse API running on port ${PORT}`);
});
