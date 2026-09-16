import psycopg2
from app.core.config import get_pg_connection_kwargs

conn = psycopg2.connect(**get_pg_connection_kwargs())

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
