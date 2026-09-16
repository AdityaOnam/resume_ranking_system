import psycopg2
from app.core.config import get_pg_connection_kwargs

try:
    conn = psycopg2.connect(**get_pg_connection_kwargs())
    cur = conn.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'")
    rows = cur.fetchall()
    print("COMPANIES COLUMNS:", [r[0] for r in rows])
    
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'resumes'")
    rows = cur.fetchall()
    print("RESUMES COLUMNS:", [r[0] for r in rows])
except Exception as e:
    print(f"Error: {e}")
