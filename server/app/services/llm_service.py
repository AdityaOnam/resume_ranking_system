import json
import logging
from typing import Dict, Any, Optional
import ollama
import psutil

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        # Dynamically select model based on available RAM to prevent crashes
        mem = psutil.virtual_memory()
        mem_percent = mem.percent
        
        # If memory usage is > 50%, fall back to the tiny 1B model. Otherwise, use 8B quantized.
        if mem_percent < 50.0:
            self.model_name = "llama3.1:8b-instruct-q2_K"
            logger.info(f"Memory is at {mem_percent}%. Using {self.model_name}.")
        else:
            self.model_name = "llama3.2:1b"
            logger.info(f"Memory is HIGH ({mem_percent}%). Using lightweight {self.model_name}.")

    def extract_resume_data(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Extracts structured JSON from raw resume text using Llama 3.1 via Ollama.
        """
        system_prompt = """You are an expert technical recruiter and data extractor. 
Your task is to parse the following raw resume text and extract the data into a strictly structured JSON format.

CRITICAL INSTRUCTIONS TO PREVENT HALLUCINATIONS:
1. DO NOT INVENT, GUESS, OR HALLUCINATE any data. If it's not explicitly written in the text, you MUST return null or [].
2. For GPA, if no explicit GPA/CPI is found, return null. Do not guess based on degree.
3. For skills, only list skills actually found in the text. Do not invent skills (e.g., do not output "Ruby" unless it is literally in the text).
4. For education, do not invent degrees or semesters (e.g., do not guess "MTech 3rd Sem").

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

    def generate_gap_analysis(self, resume_text: str, jd_text: str, match_result: Dict[str, Any]) -> str:
        """
        Generates a qualitative, natural language gap analysis explaining why the candidate 
        is or isn't a fit for the role, providing skill justification and improvement suggestions.
        """
        system_prompt = f"""You are an expert technical recruiter analyzing a candidate for a role.
You have been provided with the Job Description text, the Candidate's Resume text, and the mathematical match score calculated by our AI engine.

Match Score Data:
{json.dumps(match_result, indent=2)}

Your task is to provide a concise, professional 'Gap Analysis' (2-3 paragraphs max).
1. Acknowledge their hard filter eligibility (if they failed, explain why gently).
2. Highlight the strongest alignments (e.g., "Your experience in React Native translates well to their Flutter requirement").
3. Point out specific missing skills or areas for improvement based on the JD.

Do NOT output Markdown headers or bullet lists unless absolutely necessary. Keep it as a readable, direct feedback paragraph to the candidate."""

        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"JOB DESCRIPTION:\n{jd_text}\n\nRESUME:\n{resume_text}"}
                ],
                options={
                    "temperature": 0.4
                }
            )
            
            return response['message']['content'].strip()
            
        except Exception as e:
            logger.error(f"Error generating gap analysis with Ollama: {e}")
            return "Unable to generate AI gap analysis at this time."

    def generate_general_ats_feedback(self, resume_text: str, score_data: Dict[str, Any]) -> str:
        """
        Generates qualitative feedback for the general ATS score.
        """
        system_prompt = f"""You are an expert ATS (Applicant Tracking System) reviewer.
You have been provided with the Candidate's Resume text and their computed ATS Score breakdown.

ATS Score Breakdown:
{json.dumps(score_data.get('breakdown', {}), indent=2)}
Existing Feedback Flags:
{json.dumps(score_data.get('feedback', []), indent=2)}

Your task is to provide a concise, professional 'Resume Gap Analysis' (2-3 paragraphs max).
1. Summarize their overall resume strength based on the score ({score_data.get('score', 0)}/100).
2. Highlight areas where the resume is strong (e.g., formatting, action verbs).
3. Point out specific missing elements or areas for improvement (e.g., missing metrics, poor keyword density).

Do NOT output Markdown headers or bullet lists unless absolutely necessary. Keep it as a readable, direct feedback paragraph to the candidate."""

        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"RESUME TEXT:\n{resume_text}"}
                ],
                options={
                    "temperature": 0.4
                }
            )
            
            return response['message']['content'].strip()
            
        except Exception as e:
            logger.error(f"Error generating general ATS feedback with Ollama: {e}")
            return "Unable to generate general ATS feedback at this time."
