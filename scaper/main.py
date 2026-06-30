"""
main.py — Pipeline entry point
Runs ingest → cluster in sequence.
Call this from the Node.js backend via subprocess, or run directly:
    python main.py
"""

import logging
import sys

from ingest import run_ingest
from cluster import run_clustering

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def main():
    log.info("=== News Pulse Pipeline Starting ===")
    try:
        added = run_ingest()
        log.info(f"Ingest done. {added} new articles.")
        run_clustering()
        log.info("=== Pipeline Complete ===")
        sys.exit(0)
    except Exception as e:
        log.error(f"Pipeline failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
