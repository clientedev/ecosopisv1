import sqlite3
import os

db_path = "sql_app.db"
if not os.path.exists(db_path):
    print("Database not found.")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

new_columns = [
    ("alignment", "TEXT DEFAULT 'left'"),
    ("title_color", "TEXT DEFAULT '#ffffff'"),
    ("description_color", "TEXT DEFAULT '#ffffff'"),
    ("badge_color", "TEXT DEFAULT '#ffffff'"),
    ("badge_bg_color", "TEXT DEFAULT '#4a7c59'"),
    ("overlay_color", "TEXT DEFAULT '#000000'"),
    ("overlay_opacity", "REAL DEFAULT 0.3")
]

for col_name, col_type in new_columns:
    try:
        cursor.execute(f"ALTER TABLE carousel_items ADD COLUMN {col_name} {col_type}")
        print(f"Added column: {col_name}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Column {col_name} already exists.")
        else:
            print(f"Error adding column {col_name}: {e}")

conn.commit()
conn.close()
print("Database update complete.")
