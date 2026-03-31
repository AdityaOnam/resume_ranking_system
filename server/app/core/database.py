from supabase import create_client, Client
from app.core.config import settings

def get_supabase() -> Client:
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_KEY
    if not url or not key:
        raise ValueError("Supabase URL and Service Key must be set in the environment variables.")
    return create_client(url, key)

supabase = get_supabase()
