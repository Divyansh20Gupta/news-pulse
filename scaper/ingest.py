"""
ingest.py — RSS feed ingestion and normalization
Pulls articles from BBC, NPR, and Reuters. Normalizes into a
consistent schema and stores in PostgreSQL (deduped by URL hash).
"""

import hashlib
import logging
import os
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import feedparser
import psycopg2
import requests
import trafilatura
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Feed sources ──────────────────────────────────────────────────────────────
RSS_FEEDS = [
    {"name": "BBC",     "url": "http://feeds.bbci.co.uk/news/rss.xml"},
    {"name": "NPR",     "url": "https://feeds.npr.org/1001/rss.xml"},
    {"name": "Reuters", "url": "https://feeds.reuters.com/reuters/topNews"},
]

# ── DB helpers ────────────────────────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def init_db(conn):
    """Create tables if they don't exist yet."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS articles (
                id          SERIAL PRIMARY KEY,
                url_hash    CHAR(64) UNIQUE NOT NULL,
                url         TEXT NOT NULL,
                title       TEXT,
                summary     TEXT,
                body        TEXT,
                source      TEXT,
                published_at TIMESTAMPTZ,
                fetched_at  TIMESTAMPTZ DEFAULT NOW(),
                cluster_id  INTEGER
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS clusters (
                id         SERIAL PRIMARY KEY,
                label      TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ingest_runs (
                id         SERIAL PRIMARY KEY,
                started_at TIMESTAMPTZ DEFAULT NOW(),
                finished_at TIMESTAMPTZ,
                status     TEXT DEFAULT 'running',
                articles_added INTEGER DEFAULT 0
            );
        """)
        conn.commit()
    log.info("DB schema ready.")


# ── Date normalization ────────────────────────────────────────────────────────
def parse_date(raw) -> datetime | None:
    """Try multiple strategies to get a timezone-aware datetime."""
    if not raw:
        return None
    # feedparser gives us a time.struct_time via 'published_parsed'
    if isinstance(raw, time.struct_time):
        try:
            return datetime(*raw[:6], tzinfo=timezone.utc)
        except Exception:
            return None
    if isinstance(raw, str):
        for fmt in (
            "%a, %d %b %Y %H:%M:%S %z",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
        ):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                pass
        try:
            return parsedate_to_datetime(raw)
        except Exception:
            pass
    return None


# ── Full-text extraction ──────────────────────────────────────────────────────
def fetch_body(url: str) -> str | None:
    """Download the article page and extract the main body via trafilatura."""
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "NewsPulse/1.0"})
        resp.raise_for_status()
        text = trafilatura.extract(resp.text, include_comments=False, include_tables=False)
        return text
    except Exception as e:
        log.warning(f"Body extraction failed for {url}: {e}")
        return None


# ── Feed parsing ──────────────────────────────────────────────────────────────
def parse_feed(source: dict) -> list[dict]:
    """
    Parse one RSS source and return a list of normalized article dicts.
    Handles field-name differences across feeds gracefully.
    """
    log.info(f"Fetching feed: {source['name']} — {source['url']}")
    try:
        feed = feedparser.parse(source["url"])
    except Exception as e:
        log.error(f"Failed to parse feed {source['name']}: {e}")
        return []

    articles = []
    for entry in feed.entries:
        # Title — all feeds have this
        title = entry.get("title", "").strip()

        # URL — link is standard, but some use feedburner
        url = entry.get("link") or entry.get("feedburner_origlink", "")
        if not url:
            continue

        # Summary — <description> or <summary> depending on feed
        summary = (
            entry.get("summary")
            or entry.get("description")
            or entry.get("content", [{}])[0].get("value", "")
        ).strip()

        # Strip any lingering HTML from summary (cheap, no BeautifulSoup needed)
        import re
        summary = re.sub(r"<[^>]+>", "", summary).strip()

        # Date — prefer published_parsed (already parsed by feedparser)
        pub_date = parse_date(entry.get("published_parsed") or entry.get("updated_parsed"))
        if not pub_date:
            pub_date = parse_date(entry.get("published") or entry.get("updated"))

        articles.append({
            "url":          url,
            "url_hash":     hashlib.sha256(url.encode()).hexdigest(),
            "title":        title,
            "summary":      summary,
            "source":       source["name"],
            "published_at": pub_date,
        })

    log.info(f"  → {len(articles)} entries parsed from {source['name']}")
    return articles


# ── Dedup + store ─────────────────────────────────────────────────────────────
def store_articles(conn, articles: list[dict]) -> int:
    """Insert new articles only (skip by url_hash). Returns count of new rows."""
    added = 0
    with conn.cursor() as cur:
        # Fetch existing hashes in one query
        cur.execute("SELECT url_hash FROM articles;")
        existing = {row[0] for row in cur.fetchall()}

        for art in articles:
            if art["url_hash"] in existing:
                continue  # already stored — skip

            # Only fetch full body for new articles (saves bandwidth on reruns)
            body = fetch_body(art["url"])

            cur.execute("""
                INSERT INTO articles (url_hash, url, title, summary, body, source, published_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                art["url_hash"],
                art["url"],
                art["title"],
                art["summary"],
                body,
                art["source"],
                art["published_at"],
            ))
            existing.add(art["url_hash"])
            added += 1
            log.info(f"  + Stored: [{art['source']}] {art['title'][:60]}")

    conn.commit()
    return added


# ── Main ──────────────────────────────────────────────────────────────────────
def run_ingest() -> int:
    conn = get_conn()
    init_db(conn)

    # Log this run
    with conn.cursor() as cur:
        cur.execute("INSERT INTO ingest_runs DEFAULT VALUES RETURNING id;")
        run_id = cur.fetchone()[0]
        conn.commit()

    total_added = 0
    for source in RSS_FEEDS:
        articles = parse_feed(source)
        count = store_articles(conn, articles)
        total_added += count

    # Mark run finished
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE ingest_runs
            SET finished_at = NOW(), status = 'done', articles_added = %s
            WHERE id = %s;
        """, (total_added, run_id))
        conn.commit()

    log.info(f"Ingest complete. New articles added: {total_added}")
    conn.close()
    return total_added


if __name__ == "__main__":
    run_ingest()
