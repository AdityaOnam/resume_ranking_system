import json
from app.core.database import supabase
from app.services.embedding_engine import EmbeddingEngine
from app.services.llm_service import LLMService

def run_single_test():
    print("Fetching one company missing data...")
    # Get one company that has jd_text but is missing jd_embedding or jd_parsed or role
    response = supabase.table("companies").select("id, name, jd_text, role, internship_role, jd_embedding, jd_parsed").execute()
    
    target_company = None
    for comp in response.data:
        if comp.get("jd_text") and comp.get("jd_embedding") is None:
            target_company = comp
            break
            
    if not target_company:
        print("No companies found that are missing jd_embedding.")
        return

    print(f"Selected Company: {target_company['name']} (ID: {target_company['id']})")
    
    embedding_engine = EmbeddingEngine()
    llm_service = LLMService()
    
    update_payload = {}
    jd_text = target_company["jd_text"]
    
    print("Generating embedding...")
    update_payload["jd_embedding"] = embedding_engine.generate_job_embedding(jd_text)
        
    print("Parsing JD with LLM (this may take a moment)...")
    parsed_data = llm_service.extract_job_description_data(jd_text)
    if parsed_data:
        update_payload["jd_parsed"] = parsed_data
            
    if target_company.get("role") is None and target_company.get("internship_role"):
        update_payload["role"] = target_company["internship_role"]
        
    print("\n--- GENERATED UPDATE PAYLOAD (JSON - EMBEDDING TRUNCATED FOR READABILITY) ---")
    display_payload = update_payload.copy()
    display_payload["jd_embedding"] = f"[{len(update_payload['jd_embedding'])} floats...]"
    print(json.dumps(display_payload, indent=2))
        
    print("\n--- EQUIVALENT SQL QUERY (FULL UNTRUNCATED) ---")
    sql = f"UPDATE companies SET "
    set_clauses = []
    if "jd_embedding" in update_payload:
        # Full untruncated embedding for the actual SQL query
        set_clauses.append(f"jd_embedding = '{update_payload['jd_embedding']}'")
    if "jd_parsed" in update_payload:
        parsed_json_str = json.dumps(update_payload["jd_parsed"]).replace("'", "''")
        set_clauses.append(f"jd_parsed = '{parsed_json_str}'::jsonb")
    if "role" in update_payload:
        role_val = update_payload["role"].replace("'", "''")
        set_clauses.append(f"role = '{role_val}'")
        
    sql += ", ".join(set_clauses)
    sql += f" WHERE id = '{target_company['id']}';"
    print(sql)

    print("\n--- PYTHON SUPABASE COMMAND ---")
    print(f"supabase.table('companies').update(payload).eq('id', '{target_company['id']}').execute()")

if __name__ == "__main__":
    run_single_test()
