import asyncio
import os
from app.core.database import supabase
from app.services.embedding_engine import EmbeddingEngine

async def main():
    engine = EmbeddingEngine()
    test_embedding = engine._embed_text("This is a test resume to verify pgvector insertion.")
    
    test_resume = {
        "name": "Supabase Test Candidate",
        "email": "test-pgvector-insert@example.com",
        "resume_text": "This is a test resume to verify pgvector insertion.",
        "embedding": test_embedding
    }
    
    print(f"Attempting to insert {len(test_embedding)} dimensional vector into Supabase...")
    
    try:
        res = supabase.table("resumes").insert(test_resume).execute()
        print("Success! Row inserted with ID:", res.data[0]["id"])
    except Exception as e:
        print("Failed to insert into Supabase:")
        print(e)

if __name__ == "__main__":
    asyncio.run(main())
