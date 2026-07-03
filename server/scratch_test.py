import asyncio
from app.services.resume_parser import ResumeParser
from app.services.embedding_engine import EmbeddingEngine
import json

async def main():
    parser = ResumeParser()
    engine = EmbeddingEngine()
    
    file_path = "uploads/1d1f6877-7882-42f9-8bcc-4146722b6c08-Aditya_onam_Resume (2).pdf"
    print(f"Parsing {file_path}...")
    
    # 1. Parse Resume
    result = parser.parse(file_path)
    parsed_data = result.get("parsed_data", {})
    
    # 2. Generate Embedding
    embedding = engine.generate_resume_embedding(parsed_data)
    
    print("\n--- EXTRACTED CONTACT INFO ---")
    print(json.dumps(parsed_data.get("contact"), indent=2))
    
    print("\n--- EXTRACTED SKILLS ---")
    print(parsed_data.get("skills")[:10], "... (truncated)")
    
    print("\n--- AI EMBEDDING STATUS ---")
    print(f"Generated a {len(embedding)}-dimensional vector successfully!")

if __name__ == "__main__":
    asyncio.run(main())
