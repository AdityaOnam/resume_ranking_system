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
