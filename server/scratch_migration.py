import psycopg2
import os

# Connect to the database
conn = psycopg2.connect(
    host="db.lvraaokughgsnocpwlgu.supabase.co",
    database="postgres",
    user="postgres",
    password="p6ApS_.Q,2.qB.H",
    port=5432
)

# Open a cursor to perform database operations
cur = conn.cursor()

try:
    print("Executing ALTER TABLE...")
    cur.execute("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS ats_gap_analysis TEXT DEFAULT '';")
    print("Executing NOTIFY...")
    cur.execute("NOTIFY pgrst, 'reload schema';")
    conn.commit()
    print("Migration applied successfully!")
except Exception as e:
    print("An error occurred:", e)
    conn.rollback()
finally:
    cur.close()
    conn.close()
