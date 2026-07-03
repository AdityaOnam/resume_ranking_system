import json
import logging
from typing import Dict, Any, Optional
import ollama

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self, model_name: str = "llama3.1:8b"):
        self.model_name = model_name

    def extract_resume_data(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Extracts structured JSON from raw resume text using Llama 3.1 via Ollama.
        """
        system_prompt = """You are an expert technical recruiter and data extractor. 
Your task is to parse the following raw resume text and extract the data into a strictly structured JSON format.
If a piece of information is missing, use null or an empty list [].

The JSON MUST follow this exact schema:
{
  "contact": {
    "name": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "linkedin": "string or null",
    "github": "string or null"
  },
  "education": [
    {
      "institution": "string",
      "degree": "string (e.g., B.Tech, M.S., Ph.D)",
      "field": "string (e.g., Computer Science)",
      "gpa": "number or null",
      "start_year": "number or null",
      "end_year": "number or null"
    }
  ],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "duration": "string",
      "description": "string (Combine bullet points into a readable paragraph)"
    }
  ],
  "projects": [
    {
      "title": "string",
      "description": "string (Combine bullet points)",
      "technologies": ["string", "string"]
    }
  ],
  "skills": ["string", "string"]
}

Respond ONLY with valid JSON. Do not include markdown formatting like ```json or any conversational text."""

        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_text}
                ],
                format='json',
                options={
                    "temperature": 0.1 # Keep it deterministic for extraction
                }
            )
            
            result_text = response['message']['content']
            parsed_json = json.loads(result_text)
            return parsed_json
            
        except Exception as e:
            logger.error(f"Error communicating with Ollama or parsing JSON: {e}")
            return None

    def extract_job_description_data(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Extracts structured JSON from raw job description text using Llama 3.1.
        Matches the CompanyBase schema.
        """
        system_prompt = """You are an expert technical recruiter. 
Your task is to parse the following Job Description (JD) text and extract the data into a strictly structured JSON format matching our company schema.
If a piece of information is missing, use reasonable defaults like 0, false, or an empty list [].

The JSON MUST follow this exact schema:
{
  "name": "string (Company Name, or infer if missing)",
  "cpi": "number (Minimum GPA/CPI required, default 0.0)",
  "skill_set": ["string", "string"] (All mentioned skills),
  "internship_role": "string or null (e.g., Software Engineer Intern)",
  "visits_iit_patna": false (Assume false unless explicitly stated),
  "min_projects": "number (Minimum projects required, default 0)",
  "project_keywords": ["string", "string"] (Technologies preferred for projects),
  "branch": ["string", "string"] (Eligible branches, e.g., CSE, ECE),
  "dsa_required": "boolean (True if Data Structures / Algorithms is mentioned)",
  "core_skills": ["string", "string"] (Must-have core skills),
  "description": "string (Brief summary of the role)"
}

Respond ONLY with valid JSON. Do not include markdown formatting like ```json or any conversational text."""

        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_text}
                ],
                format='json',
                options={
                    "temperature": 0.1
                }
            )
            
            result_text = response['message']['content']
            parsed_json = json.loads(result_text)
            return parsed_json
            
        except Exception as e:
            logger.error(f"Error communicating with Ollama or parsing JD JSON: {e}")
            return None

