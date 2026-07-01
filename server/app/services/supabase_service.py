import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase URL and Key must be set in the .env file")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class SupabaseService:
    @staticmethod
    def upload_resume_file(file_bytes: bytes, file_name: str, user_id: str = None) -> str:
        """
        Uploads a resume file to the Supabase 'resumes' storage bucket.
        Returns the public URL or file path.
        """
        # Create a unique file path, optionally under a user's directory
        path = f"{user_id}/{file_name}" if user_id else file_name
        
        # Upload the file
        res = supabase.storage.from_("resumes").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": "application/pdf"}
        )
        return path

    @staticmethod
    def save_resume_record(user_id: str, file_path: str, raw_text: str, parsed_data: dict) -> dict:
        """
        Saves the parsed resume metadata and raw text into the 'resumes' database table.
        """
        data = {
            "file_path": file_path,
            "raw_text": raw_text,
            "parsed_data": parsed_data
        }
        
        if user_id:
            data["user_id"] = user_id
            
        response = supabase.table("resumes").insert(data).execute()
        
        if response.data:
            return response.data[0]
        return {}
