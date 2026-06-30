// ingest.js
const express       = require("express");
const router        = express.Router();
const { spawn }     = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path          = require("path");

const jobs = new Map();

// POST /ingest/trigger
router.post("/trigger", (req, res) => {
  const jobId = uuidv4();
  const scraperDir = process.env.SCRAPER_DIR || path.join(__dirname, "../scraper");

  jobs.set(jobId, {
    status:     "running",
    startedAt:  new Date().toISOString(),
    finishedAt: null,
    output:     "",
    error:      null,
  });

  const proc = spawn("python", ["main.py"], {
    cwd: scraperDir,
    env: { ...process.env },
  });

  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (data) => { stdout += data.toString(); });
  proc.stderr.on("data", (data) => { stderr += data.toString(); });

  proc.on("close", (code) => {
    const job = jobs.get(jobId);
    if (code === 0) {
      job.status = "done";
      job.output = stdout;
    } else {
      job.status = "error";
      job.error  = stderr || `Exited with code ${code}`;
    }
    job.finishedAt = new Date().toISOString();
    console.log(`[ingest] Job ${jobId} finished — status: ${job.status}`);
  });

  proc.on("error", (err) => {
    const job      = jobs.get(jobId);
    job.status     = "error";
    job.error      = `Failed to start Python: ${err.message}`;
    job.finishedAt = new Date().toISOString();
  });

  res.status(202).json({ jobId, status: "running" });
});

// GET /ingest/status/:jobId
router.get("/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json({
    jobId,
    status:     job.status,
    startedAt:  job.startedAt,
    finishedAt: job.finishedAt,
    ...(job.status === "error" && { error: job.error }),
  });
});

module.exports = router;
