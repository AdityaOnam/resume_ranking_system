import argparse
import sys
import logging
from app.core.database import get_supabase
from app.services.embedding_engine import EmbeddingEngine
from app.services.llm_service import LLMService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description="Backfill missing company columns in Supabase.")
    parser.add_argument("--apply", action="store_true", help="Actually execute the updates.")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Run in dry-run mode (default).")
    args = parser.parse_args()

    is_dry_run = not args.apply

    logger.info("Initializing services...")
    supabase = get_supabase()
    embedding_engine = EmbeddingEngine()
    llm_service = LLMService()

    logger.info("Fetching companies...")
    response = supabase.table("companies").select("id, name, jd_text, role, internship_role, jd_embedding, jd_parsed").execute()
    companies = response.data
    
    total_companies = len(companies)
    logger.info(f"Found {total_companies} companies.")

    stats = {
        "jd_embedding": 0,
        "jd_parsed": 0,
        "role": 0,
        "skipped_empty_jd": 0
    }
    jd_parsed_failures = []

    if is_dry_run:
        logger.info("\n--- STARTING DRY RUN --- (No data will be changed)")
    else:
        logger.info("\n--- STARTING APPLY --- (Updating database)")

    for i, row in enumerate(companies, 1):
        company_name = row.get("name", "Unknown")
        company_id = row.get("id")
        jd_text = row.get("jd_text")
        
        # 1. Skip if jd_text is completely empty
        if not jd_text or not jd_text.strip():
            logger.info(f"[{i}/{total_companies}] {company_name}: Skipped (jd_text is missing or empty)")
            stats["skipped_empty_jd"] += 1
            continue

        update_payload = {}
        actions_taken = []

        # 2. Check jd_embedding
        if row.get("jd_embedding") is None:
            update_payload["jd_embedding"] = embedding_engine.generate_job_embedding(jd_text)
            actions_taken.append("jd_embedding computed")
            stats["jd_embedding"] += 1

        # 3. Check jd_parsed
        if row.get("jd_parsed") is None:
            try:
                parsed_data = llm_service.extract_job_description_data(jd_text)
                if parsed_data:
                    update_payload["jd_parsed"] = parsed_data
                    actions_taken.append("jd_parsed computed")
                    stats["jd_parsed"] += 1
                else:
                    # extract_job_description_data returned None, likely an Ollama error that was caught inside it
                    jd_parsed_failures.append(company_name)
                    actions_taken.append("jd_parsed generation returned None")
            except Exception as e:
                # Catch any unexpected errors just in case, so it doesn't block embedding updates
                jd_parsed_failures.append(company_name)
                actions_taken.append(f"jd_parsed failed: {e}")

        # 4. Check role
        if row.get("role") is None and row.get("internship_role"):
            update_payload["role"] = row.get("internship_role")
            actions_taken.append("role backfilled from internship_role")
            stats["role"] += 1

        # Process the updates if any are needed
        if update_payload:
            action_str = ", ".join(actions_taken)
            if is_dry_run:
                logger.info(f"[{i}/{total_companies}] {company_name}: [DRY RUN] Would update: {action_str}")
            else:
                logger.info(f"[{i}/{total_companies}] {company_name}: Updating: {action_str}")
                try:
                    supabase.table("companies").update(update_payload).eq("id", company_id).execute()
                except Exception as e:
                    logger.error(f"[{i}/{total_companies}] {company_name}: Database update failed: {e}")
        else:
             # Nothing to update
             pass

    # Final Summary
    logger.info("\n--- FINAL SUMMARY ---")
    logger.info(f"Rows with empty jd_text (skipped): {stats['skipped_empty_jd']}")
    logger.info(f"jd_embedding generated: {stats['jd_embedding']}")
    logger.info(f"jd_parsed generated: {stats['jd_parsed']}")
    logger.info(f"role backfilled: {stats['role']}")
    
    if jd_parsed_failures:
        logger.warning(f"\njd_parsed generation failed for {len(jd_parsed_failures)} companies:")
        for name in jd_parsed_failures:
            logger.warning(f"  - {name}")

if __name__ == "__main__":
    main()
