// timeline.js
const express = require("express");
const router  = express.Router();
const db      = require("./db");

router.get("/", async (req, res) => {
  const sourceFilter = req.query.source
    ? req.query.source.split(",").map((s) => s.trim())
    : null;

  try {
    let query = `
      SELECT
        c.id,
        c.label,
        MIN(a.published_at)          AS start,
        MAX(a.published_at)          AS end,
        COUNT(a.id)::int             AS article_count,
        ARRAY_AGG(DISTINCT a.source) AS sources
      FROM clusters c
      JOIN articles a ON a.cluster_id = c.id
    `;
    const params = [];

    if (sourceFilter && sourceFilter.length > 0) {
      query += ` WHERE a.source = ANY($1)`;
      params.push(sourceFilter);
    }

    query += `
      GROUP BY c.id, c.label
      HAVING COUNT(a.id) > 0
      ORDER BY MIN(a.published_at) DESC NULLS LAST;
    `;

    const { rows } = await db.query(query, params);

    const counts   = rows.map((r) => r.article_count);
    const maxCount = counts.length ? Math.max(...counts) : 1;

    const timeline = rows.map((row) => ({
      id:            row.id,
      label:         row.label,
      start:         row.start,
      end:           row.end,
      article_count: row.article_count,
      intensity:     parseFloat((row.article_count / maxCount).toFixed(3)),
      sources:       row.sources,
    }));

    res.json({ timeline });
  } catch (err) {
    console.error("GET /timeline error:", err);
    res.status(500).json({ error: "Failed to build timeline" });
  }
});

module.exports = router;
