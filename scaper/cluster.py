"""
cluster.py — Topic grouping via TF-IDF + cosine similarity

Approach: TF-IDF was chosen over simple keyword overlap because it
naturally down-weights common words (even without an explicit stop-word list)
and produces more coherent clusters on news text. Cosine similarity on those
vectors groups articles whose vocabulary is proportionally similar, not just
sharing one loud keyword.

Parameters chosen:
  - max_features=5000: caps vocabulary size, avoids noise from rare typos
  - similarity threshold=0.25: tuned by manual inspection — too high gives
    too many singletons, too low merges unrelated stories
  - min_cluster_size=2: singletons are noise for a timeline, kept separate

Known limitation: TF-IDF treats each run's corpus in isolation. Articles
added in a later run may not cluster with earlier related ones because the
IDF weights shift. A production system would use a vector DB with persistent
embeddings instead.
"""

import logging
import os

import numpy as np
import psycopg2
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.12 
MIN_CLUSTER_SIZE = 2          


# ── DB helpers ────────────────────────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def fetch_articles(conn) -> list[dict]:
    """Load all articles that haven't been clustered yet."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, title, summary, body, source, published_at
            FROM articles
            WHERE cluster_id IS NULL
              AND (title IS NOT NULL OR summary IS NOT NULL)
            ORDER BY published_at DESC NULLS LAST;
        """)
        rows = cur.fetchall()
    cols = ["id", "title", "summary", "body", "source", "published_at"]
    return [dict(zip(cols, r)) for r in rows]


# ── Text preparation ──────────────────────────────────────────────────────────
def build_text(article: dict) -> str:
    """
    Concatenate title + summary + first 500 chars of body.
    Title is repeated 3x to give it more weight in TF-IDF.
    """
    title   = (article["title"]   or "").strip()
    summary = (article["summary"] or "").strip()
    body    = (article["body"]    or "")[:500].strip()
    return f"{title} {title} {title} {summary} {body}"


# ── Clustering ────────────────────────────────────────────────────────────────
def cluster_articles(articles: list[dict]) -> list[list[int]]:
    """
    Returns a list of clusters, each cluster being a list of article IDs.
    Uses single-linkage: if A~B and B~C, A+B+C form one cluster.
    """
    if len(articles) < 2:
        return [[a["id"]] for a in articles]

    texts = [build_text(a) for a in articles]
    ids   = [a["id"] for a in articles]

    # Build TF-IDF matrix
    vectorizer = TfidfVectorizer(
        max_features=5000,
        stop_words="english",
        ngram_range=(1, 2),   # include bigrams — "climate change", "interest rate"
        sublinear_tf=True,    # dampen very high term frequencies
    )
    tfidf_matrix = vectorizer.fit_transform(texts)

    # Pairwise cosine similarity (n×n matrix — fine for <5000 articles)
    sim_matrix = cosine_similarity(tfidf_matrix)

    # Union-Find for single-linkage grouping
    parent = list(range(len(ids)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        parent[find(x)] = find(y)

    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if sim_matrix[i][j] >= SIMILARITY_THRESHOLD:
                union(i, j)

    # Group by root
    groups: dict[int, list[int]] = {}
    for i, article_id in enumerate(ids):
        root = find(i)
        groups.setdefault(root, []).append(article_id)

    return list(groups.values())


# ── Label generation ──────────────────────────────────────────────────────────
def generate_label(article_ids: list[int], articles_by_id: dict) -> str:
    """
    Label a cluster using the top TF-IDF terms across its articles.
    Falls back to the shortest headline if vectorizer fails.
    """
    texts = [build_text(articles_by_id[aid]) for aid in article_ids]
    try:
        vec = TfidfVectorizer(
            max_features=500,
            stop_words="english",
            ngram_range=(1, 2),
        )
        mat = vec.fit_transform(texts)
        # Sum TF-IDF scores across all articles in cluster
        scores = np.asarray(mat.sum(axis=0)).flatten()
        top_indices = scores.argsort()[-3:][::-1]
        terms = vec.get_feature_names_out()
        return " / ".join(terms[i].title() for i in top_indices)
    except Exception:
        # Fallback: shortest title
        titles = [articles_by_id[aid]["title"] or "" for aid in article_ids]
        return min(titles, key=len) or "Untitled Cluster"


# ── Save clusters ─────────────────────────────────────────────────────────────
def save_clusters(conn, clusters: list[list[int]], articles_by_id: dict):
    """Clear old cluster assignments, write new ones."""
    with conn.cursor() as cur:
        # Reset previous clustering (re-cluster from scratch each run)
        cur.execute("UPDATE articles SET cluster_id = NULL;")
        cur.execute("DELETE FROM clusters;")
        conn.commit()

        saved = 0
        for group in clusters:
            if len(group) < MIN_CLUSTER_SIZE:
                continue  # skip singletons

            label = generate_label(group, articles_by_id)

            cur.execute(
                "INSERT INTO clusters (label) VALUES (%s) RETURNING id;",
                (label,)
            )
            cluster_id = cur.fetchone()[0]

            cur.execute(
                "UPDATE articles SET cluster_id = %s WHERE id = ANY(%s);",
                (cluster_id, group)
            )
            saved += 1
            log.info(f"  Cluster [{cluster_id}] '{label}' — {len(group)} articles")

        conn.commit()
        log.info(f"Saved {saved} clusters.")


# ── Main ──────────────────────────────────────────────────────────────────────
def run_clustering():
    conn = get_conn()
    articles = fetch_articles(conn)

    if not articles:
        log.info("No unclustered articles found — nothing to do.")
        conn.close()
        return

    log.info(f"Clustering {len(articles)} articles...")

    articles_by_id = {a["id"]: a for a in articles}
    clusters = cluster_articles(articles)
    save_clusters(conn, clusters, articles_by_id)

    conn.close()
    log.info("Clustering complete.")


if __name__ == "__main__":
    run_clustering()
