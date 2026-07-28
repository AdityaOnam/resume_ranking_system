import psycopg2

try:
    conn = psycopg2.connect(
        host='db.lvraaokughgsnocpwlgu.supabase.co',
        port=5432,
        dbname='postgres',
        user='postgres',
        password='p6ApS_.Q,2.qB.H'
    )
    cur = conn.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'")
    rows = cur.fetchall()
    print("COMPANIES COLUMNS:", [r[0] for r in rows])
    
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'resumes'")
    rows = cur.fetchall()
    print("RESUMES COLUMNS:", [r[0] for r in rows])
except Exception as e:
    print(f"Error: {e}")
