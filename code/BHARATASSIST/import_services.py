"""
Safe, idempotent importer and indexer for BharatAssist government services.

Usage:
    python import_services.py

Features:
- Imports records from government_services_expanded.csv into SQLite without wiping tables.
- Preserves existing service IDs and other tables (users, chat_history, search_logs).
- Idempotent upsert (updates existing by name, inserts new).
- Syncs SQLite records to ChromaDB with stable IDs.
- Reports inserted, updated, skipped, and total records.
- Creates automatic backups before modification.
"""

import os
import sys
import csv
import shutil
import sqlite3

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "bharatassist.db")
CSV_PATH = os.path.join(BASE_DIR, "government_services_expanded.csv")

from utils.rag import add_service_to_index, init_vector_store


def backup_database():
    """Create a timestamped backup before modifying sqlite or chroma."""
    if os.path.exists(DB_PATH):
        backup_file = os.path.join(BASE_DIR, "bharatassist_backup.db")
        shutil.copy2(DB_PATH, backup_file)
        print(f"[OK] Database backed up to {backup_file}")


def import_csv_to_db(csv_file=CSV_PATH):
    """
    Idempotent upsert of CSV services into SQLite services table.
    Does not delete any existing user data, chat history, or search logs.
    """
    if not os.path.exists(csv_file):
        raise FileNotFoundError(f"CSV file not found: {csv_file}")

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Ensure table exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            state TEXT DEFAULT 'All India',
            eligibility TEXT,
            documents_required TEXT,
            steps TEXT,
            fees TEXT,
            processing_time TEXT,
            source_url TEXT,
            last_verified TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    with open(csv_file, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Read {len(rows)} service definitions from {os.path.basename(csv_file)}")

    inserted = 0
    updated = 0
    skipped = 0

    for r in rows:
        name = (r.get("name") or "").strip()
        if not name:
            skipped += 1
            continue

        category = (r.get("category") or "").strip()
        state = (r.get("state") or "All India").strip()
        eligibility = (r.get("eligibility") or "").strip()
        docs = (r.get("documents_required") or "").strip()
        steps = (r.get("steps") or "").strip()
        fees = (r.get("fees") or "").strip()
        ptime = (r.get("processing_time") or "").strip()
        source_url = (r.get("source_url") or "").strip()
        last_verified = (r.get("last_verified") or "").strip()

        cur.execute("SELECT id FROM services WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))", (name,))
        existing = cur.fetchone()

        if existing:
            updated += 1
            cur.execute("""
                UPDATE services
                SET category = ?, state = ?, eligibility = ?, documents_required = ?,
                    steps = ?, fees = ?, processing_time = ?, source_url = ?, last_verified = ?
                WHERE id = ?
            """, (category, state, eligibility, docs, steps, fees, ptime, source_url, last_verified, existing[0]))
        else:
            inserted += 1
            cur.execute("""
                INSERT INTO services (
                    name, category, state, eligibility, documents_required,
                    steps, fees, processing_time, source_url, last_verified
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, category, state, eligibility, docs, steps, fees, ptime, source_url, last_verified))

    conn.commit()

    cur.execute("SELECT count(*) FROM services")
    total_services = cur.fetchone()[0]
    conn.close()

    print(f"[DB] Inserted: {inserted}, Updated: {updated}, Skipped: {skipped}, Total in DB: {total_services}")
    return total_services


def sync_all_services_to_chroma():
    """
    Sync all services from SQLite to ChromaDB with stable IDs.
    Does not drop unrelated collections.
    """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, name, category, state, eligibility, documents_required,
               steps, fees, processing_time, source_url, last_verified
        FROM services
        ORDER BY id ASC
    """)
    rows = cur.fetchall()
    conn.close()

    print(f"Syncing {len(rows)} services from SQLite to ChromaDB...")
    collection = init_vector_store()

    indexed = 0
    for row in rows:
        sid, name, cat, state, elig, docs, steps, fees, ptime, url, last_ver = row
        text_blob = (
            f"Service: {name}. "
            f"Category: {cat or ''}. "
            f"State: {state or 'All India'}. "
            f"Eligibility: {elig or ''}. "
            f"Documents required: {docs or ''}. "
            f"Steps: {steps or ''}. "
            f"Fees: {fees or ''}. "
            f"Processing time: {ptime or ''}. "
            f"Official source: {url or ''}. "
            f"Last verified: {last_ver or ''}."
        )

        add_service_to_index(
            service_id=sid,
            name=name,
            text_blob=text_blob,
            category=cat or "",
            state=state or "All India",
            source_url=url or "",
            last_verified=last_ver or ""
        )
        indexed += 1

    print(f"[ChromaDB] Indexed {indexed} services. Total in vector store: {collection.count()}")


def run():
    print("==========================================")
    print(" BharatAssist Safe Catalog Importer")
    print("==========================================")
    backup_database()
    import_csv_to_db()
    sync_all_services_to_chroma()
    print("==========================================")
    print(" Catalog import and indexing complete!")
    print("==========================================")


if __name__ == "__main__":
    run()
