# News Pulse — Topic-Clustered News Timeline

A full-stack system that pulls live articles from news RSS feeds, automatically groups related articles into topic clusters using TF-IDF, and displays those clusters as a visual timeline.

**Live:** https://news-pulse-rho-lyart.vercel.app/ 
**Backend API:** https://news-pulse-backend-qbsl.onrender.com
**Video walkthrough:** https://drive.google.com/file/d/1dKQeQBGUQnFo4CxvuY2g57hHupyAxkb7/view?usp=sharing

---

## Architecture

```
/scaper     Python — RSS ingestion, full-text extraction, TF-IDF topic clustering
/backend    Node.js / Express — REST API, reads from Postgres
/frontend   Next.js / React — timeline visualization, cluster explorer
```

| Component | Hosted on |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Database | Supabase (Postgres) |
| Scraper | Triggered on-demand via the backend (`POST /ingest/trigger`) |

---

## Setup instructions

### 1. Database
Create a free [Supabase](https://supabase.com) project. Tables (`articles`, `clusters`, `ingest_runs`) are auto-created on first scraper run — no manual SQL needed.

Use the **Session pooler** connection string (not the direct connection) if deploying to a host without IPv6 support — Render and several other free-tier platforms route over IPv4 only, and Supabase's direct connection defaults to IPv6.

### 2. Scraper
```bash
cd scaper
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL
python main.py
```

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, PORT, FRONTEND_URL, SCRAPER_DIR
node index.js
```

### 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL to your backend URL
npm run dev
```

---

## Topic grouping approach

**TF-IDF + cosine similarity** was used over simple keyword overlap because it naturally down-weights common words without needing an explicit stop-word list, and produces more coherent clusters on news-style text.

- Each article's `title × 3 + summary + first 500 chars of body` is vectorized (title repeated to weight headlines more heavily)
- Bigrams are included so phrases like "interest rate" or "climate change" cluster correctly, not just single words
- Pairwise cosine similarity is computed; articles above a **0.25 similarity threshold** are merged using single-linkage (union-find), so if A~B and B~C, all three land in one cluster
- Cluster labels are generated from the top 3 TF-IDF terms across the cluster's combined text

**Why this threshold:** tuned by manual inspection on a real run — much lower (~0.1) over-merged unrelated stories that happened to share generic words; much higher (~0.4) left almost every article as its own singleton. 0.25 was the sweet spot for the corpus sizes seen during testing (40–50 articles per run).

### Limitation

TF-IDF treats each clustering run's corpus in isolation. Articles ingested in a later run may fail to join an existing cluster from an earlier run, because the IDF weights are recalculated from scratch each time the full pipeline runs. A production version would persist embeddings (e.g. in a vector DB) so new articles can be compared against historical ones rather than re-clustering from zero each run.

---

## News sources used

- BBC News — `http://feeds.bbci.co.uk/news/rss.xml`
- NPR — `https://feeds.npr.org/1001/rss.xml`
- Reuters — `https://feeds.reuters.com/reuters/topNews` *(feed was intermittently returning 0 entries during testing — BBC and NPR consistently provided sufficient article volume)*

---

## Notes on assumptions

- Duplicate detection is by exact URL hash, not cross-source story matching (cross-source merging was treated as the stated stretch goal and left out for time).
- The ingest pipeline is re-runnable: it only fetches full article bodies for URLs not already stored, so repeated runs are cheap.
- Clustering re-runs from scratch on every pipeline execution (resets all `cluster_id` values, deletes old clusters, regroups everything) rather than incrementally clustering only new articles. This was simpler to reason about and verify correctness for, at the cost of the IDF-isolation limitation above.
