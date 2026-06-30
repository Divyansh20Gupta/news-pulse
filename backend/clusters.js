// clusters.js
const express = require("express");
const router  = express.Router();
const db      = require("./db");

// GET /clusters — list all clusters with label, article count, time range
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        c.id,
        c.label,
        COUNT(a.id)::int                        AS article_count,
        MIN(a.published_at)                     AS earliest,
        MAX(a.published_at)                     AS latest,
        ARRAY_AGG(DISTINCT a.source)            AS sources
      FROM clusters c
      JOIN articles a ON a.cluster_id = c.id
      GROUP BY c.id, c.label
      ORDER BY MAX(a.published_at) DESC NULLS LAST;
    `);
    res.json({ clusters: rows });
  } catch (err) {
    console.error("GET /clusters error:", err);
    res.status(500).json({ error: "Failed to fetch clusters" });
  }
});

// GET /clusters/:id — full cluster detail with all articles
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ error: "Invalid cluster ID" });
  }

  try {
    const clusterRes = await db.query(
      `SELECT id, label, created_at FROM clusters WHERE id = $1;`,
      [id]
    );
    if (clusterRes.rows.length === 0) {
      return res.status(404).json({ error: "Cluster not found" });
    }

    const articlesRes = await db.query(
      `SELECT id, title, summary, url, source, published_at
       FROM articles
       WHERE cluster_id = $1
       ORDER BY published_at ASC NULLS LAST;`,
      [id]
    );

    res.json({
      cluster:  clusterRes.rows[0],
      articles: articlesRes.rows,
    });
  } catch (err) {
    console.error(`GET /clusters/${id} error:`, err);
    res.status(500).json({ error: "Failed to fetch cluster detail" });
  }
});

module.exports = router;
