import psycopg2

conn = psycopg2.connect(
    host='db.lvraaokughgsnocpwlgu.supabase.co',
    database='postgres',
    user='postgres',
    password='p6ApS_.Q,2.qB.H',
    port=5432
)

cur = conn.cursor()
try:
    print('Executing ALTER TABLE jobs...')
    cur.execute('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);')
    cur.execute("NOTIFY pgrst, 'reload schema';")
    conn.commit()
    print('Migration applied successfully!')
except Exception as e:
    print('An error occurred:', e)
    conn.rollback()
finally:
    cur.close()
    conn.close()
