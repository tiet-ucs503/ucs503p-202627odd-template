import sqlite3
from pathlib import Path
from datetime import datetime


DB_DIR = Path.home() / ".versionvault"
DB_PATH = DB_DIR / "versionvault.db"


def getConnection():
    DB_DIR.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DB_PATH)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS tracked_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id TEXT NOT NULL UNIQUE,
            item_type TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )
    """)

    connection.commit()

    return connection


def addItem(itemId, itemType, path):
    connection = getConnection()

    try:
        connection.execute(
            """
            INSERT INTO tracked_items
            (item_id, item_type, path, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                itemId,
                itemType,
                str(Path(path).expanduser().resolve()),
                datetime.now().isoformat()
            )
        )

        connection.commit()
        return True

    except sqlite3.IntegrityError:
        return False

    finally:
        connection.close()


def getItem(itemId):
    connection = getConnection()

    cursor = connection.execute(
        """
        SELECT item_id, item_type, path, created_at
        FROM tracked_items
        WHERE item_id = ?
        """,
        (itemId,)
    )

    item = cursor.fetchone()

    connection.close()

    return item


def getItemByPath(path):
    connection = getConnection()

    normalizedPath = str(
        Path(path).expanduser().resolve()
    )

    cursor = connection.execute(
        """
        SELECT item_id, item_type, path, created_at
        FROM tracked_items
        WHERE path = ?
        """,
        (normalizedPath,)
    )

    item = cursor.fetchone()

    connection.close()

    return item


def removeItem(itemId):
    connection = getConnection()

    cursor = connection.execute(
        """
        DELETE FROM tracked_items
        WHERE item_id = ?
        """,
        (itemId,)
    )

    connection.commit()

    deleted = cursor.rowcount > 0

    connection.close()

    return deleted


def getAllItems():
    connection = getConnection()

    cursor = connection.execute(
        """
        SELECT item_id, item_type, path, created_at
        FROM tracked_items
        ORDER BY id
        """
    )

    items = cursor.fetchall()

    connection.close()

    return items


def generateItemId(itemType):
    connection = getConnection()

    prefix = "f" if itemType == "file" else "d"

    cursor = connection.execute(
        """
        SELECT item_id
        FROM tracked_items
        WHERE item_type = ?
        """,
        (itemType,)
    )

    items = cursor.fetchall()

    connection.close()

    maxNumber = 0

    for item in items:
        itemId = item[0]

        if itemId.startswith(prefix):
            try:
                number = int(itemId[1:])
                maxNumber = max(maxNumber, number)
            except ValueError:
                pass

    return f"{prefix}{maxNumber + 1}"