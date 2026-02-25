import sqlite3
import os

db_path = "sql_app.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    with open("db_info.txt", "w") as f:
        f.write("--- users ---\n")
        cursor.execute("PRAGMA table_info(users)")
        for col in cursor.fetchall():
            f.write(str(col) + "\n")
            
        f.write("\n--- roulette_prizes ---\n")
        cursor.execute("PRAGMA table_info(roulette_prizes)")
        for col in cursor.fetchall():
            f.write(str(col) + "\n")
            
    print("\n--- Dumping users to users_list.txt ---")
    with open("users_list.txt", "w") as f:
        cursor.execute("SELECT id, email, role, full_name FROM users")
        for user in cursor.fetchall():
            f.write(f"ID: {user[0]} | Email: {user[1]} | Role: {user[2]} | Name: {user[3]}\n")
            
    conn.close()
else:
    print(f"Database {db_path} not found.")
