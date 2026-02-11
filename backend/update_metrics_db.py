import sqlite3
import os

db_path = "sql_app.db"
if not os.path.exists(db_path):
    print("Database not found.")
    exit()

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create site_visits table
cursor.execute('''
CREATE TABLE IF NOT EXISTS site_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
''')

# Create product_clicks table
cursor.execute('''
CREATE TABLE IF NOT EXISTS product_clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    click_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
)
''')

conn.commit()
conn.close()
print("Metrics tables created successfully.")
