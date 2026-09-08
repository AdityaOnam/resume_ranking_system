import json
import logging
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates (shared across both providers)
# ---------------------------------------------------------------------------

_RESUME_SYSTEM_PROMPT = """You are an expert technical recruiter and data extractor. 
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

_JD_SYSTEM_PROMPT = """You are an expert technical recruiter. 
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


def _build_gap_analysis_system_prompt(match_result: Dict[str, Any]) -> str:
    return f"""You are an expert technical recruiter analyzing a candidate for a role.
You have been provided with the Job Description text, the Candidate's Resume text, and the mathematical match score calculated by our AI engine.

Match Score Data:
{json.dumps(match_result, indent=2)}

Your task is to provide a concise, professional 'Gap Analysis' (2-3 paragraphs max).
1. Acknowledge their hard filter eligibility (if they failed, explain why gently).
2. Highlight the strongest alignments (e.g., "Your experience in React Native translates well to their Flutter requirement").
3. Point out specific missing skills or areas for improvement based on the JD.

Do NOT output Markdown headers or bullet lists unless absolutely necessary. Keep it as a readable, direct feedback paragraph to the candidate."""


def _build_ats_feedback_system_prompt(score_data: Dict[str, Any]) -> str:
    return f"""You are an expert ATS (Applicant Tracking System) reviewer.
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


# ===========================================================================
# Ollama Backend
# ===========================================================================

class _OllamaBackend:
    """Wraps the Ollama Python client. Used when LLM_PROVIDER=ollama."""

    def __init__(self):
        import ollama
        self.model_name = settings.OLLAMA_MODEL_NAME
        self._client = ollama.Client(
            host=settings.OLLAMA_HOST,
            timeout=settings.OLLAMA_TIMEOUT_SECONDS,
        )
        logger.info(
            f"LLM Provider: Ollama | model={self.model_name} "
            f"host={settings.OLLAMA_HOST} timeout={settings.OLLAMA_TIMEOUT_SECONDS}s"
        )

    def chat_json(self, system_prompt: str, user_content: str, temperature: float = 0.1) -> Optional[Dict[str, Any]]:
        try:
            response = self._client.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                format="json",
                options={"temperature": temperature},
            )
            return json.loads(response["message"]["content"])
        except Exception as e:
            logger.error(f"Ollama JSON chat failed: {e}")
            return None

    def chat_text(self, system_prompt: str, user_content: str, temperature: float = 0.4) -> str:
        try:
            response = self._client.chat(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                options={"temperature": temperature},
            )
            return response["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Ollama text chat failed: {e}")
            return ""


# ===========================================================================
# Gemini Backend (with multi-key rotation)
# ===========================================================================

class _GeminiBackend:
    """Wraps the Google GenAI SDK. Supports multiple API keys with automatic
    rotation when a key hits its rate limit (HTTP 429)."""

    def __init__(self):
        from google import genai

        raw_keys = settings.GEMINI_API_KEYS
        self._keys: List[str] = [k.strip() for k in raw_keys.split(",") if k.strip()]
        if not self._keys:
            raise ValueError(
                "LLM_PROVIDER is set to 'gemini' but GEMINI_API_KEYS is empty. "
                "Provide at least one Gemini API key in your .env file."
            )
        self._genai_module = genai
        self._model_name = settings.GEMINI_MODEL_NAME
        self._timeout = settings.GEMINI_TIMEOUT_SECONDS
        self._current_key_index = 0

        # Pre-build one client per key so we can rotate instantly on 429
        self._clients = [genai.Client(api_key=key) for key in self._keys]

        logger.info(
            f"LLM Provider: Gemini | model={self._model_name} "
            f"keys={len(self._keys)} timeout={self._timeout}s"
        )

    def _rotate_key(self) -> bool:
        """Advance to the next key."""
        self._current_key_index += 1
        if self._current_key_index >= len(self._clients):
            self._current_key_index = 0
        return True

    def chat_json(self, system_prompt: str, user_content: str, temperature: float = 0.1) -> Optional[Dict[str, Any]]:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            response_mime_type="application/json",
            http_options=types.HttpOptions(timeout=self._timeout * 1000),
        )
        return self._execute_with_rotation(user_content, config, parse_json=True)

    def chat_text(self, system_prompt: str, user_content: str, temperature: float = 0.4) -> str:
        from google.genai import types

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            http_options=types.HttpOptions(timeout=self._timeout * 1000),
        )
        result = self._execute_with_rotation(user_content, config, parse_json=False)
        return result if result else ""

    def _execute_with_rotation(self, user_content: str, config, parse_json: bool):
        """Try each API key in order. On rate-limit (429), rotate to the next."""
        start_index = self._current_key_index
        tried = 0

        while tried < len(self._clients):
            client = self._clients[self._current_key_index]
            try:
                response = client.models.generate_content(
                    model=self._model_name,
                    contents=user_content,
                    config=config,
                )
                text = response.text
                if not text:
                    logger.warning(f"Gemini API (key #{self._current_key_index + 1}) returned empty text. Candidates: {response.candidates}")
                else:
                    logger.info(f"Gemini API call succeeded. Response length: {len(text)}")
                
                if parse_json:
                    return json.loads(text)
                return text.strip() if text else ""

            except Exception as e:
                error_str = str(e).lower()
                logger.error(f"Gemini API call failed (key #{self._current_key_index + 1}): {type(e).__name__} - {error_str}")
                is_rate_limit = "429" in error_str or "resource_exhausted" in error_str or "quota" in error_str

                if is_rate_limit and self._rotate_key():
                    key_num = self._current_key_index + 1
                    logger.warning(f"Gemini key #{key_num - 1} rate-limited, rotating to key #{key_num}")
                    tried += 1
                    continue
                else:
                    return None if parse_json else ""

        # All keys exhausted
        logger.error("All Gemini API keys exhausted (rate-limited).")
        self._current_key_index = start_index
        return None if parse_json else ""


# ===========================================================================
# Groq Backend
# ===========================================================================

class _GroqBackend:
    """Wraps the Groq API client. Used when LLM_PROVIDER=groq.

    Supports multiple API keys with automatic rotation on rate limits (HTTP
    429), mirroring the Gemini backend - Groq's free tier has per-minute and
    per-day request caps that a batch of uploads can reach quickly.
    """

    def __init__(self):
        from groq import Groq
        self.model_name = settings.GROQ_MODEL_NAME
        self._timeout = settings.GROQ_TIMEOUT_SECONDS

        # GROQ_API_KEYS (plural, comma-separated) preferred; GROQ_API_KEY kept
        # working for backwards compatibility.
        raw_keys = settings.GROQ_API_KEYS or settings.GROQ_API_KEY
        self._keys: List[str] = [k.strip() for k in raw_keys.split(",") if k.strip()]
        if not self._keys:
            raise ValueError(
                "LLM_PROVIDER is set to 'groq' but no Groq API key is configured. "
                "Set GROQ_API_KEYS (comma-separated for rotation) or GROQ_API_KEY "
                "in your .env file, or as a Cloud Run environment variable."
            )

        self._clients = [Groq(api_key=key, timeout=self._timeout) for key in self._keys]
        self._current_key_index = 0

        logger.info(
            f"LLM Provider: Groq | model={self.model_name} "
            f"keys={len(self._keys)} timeout={self._timeout}s"
        )

    def _rotate_key(self):
        self._current_key_index = (self._current_key_index + 1) % len(self._clients)

    def _execute_with_rotation(self, system_prompt: str, user_content: str,
                               temperature: float, parse_json: bool):
        start_index = self._current_key_index
        tried = 0

        while tried < len(self._clients):
            client = self._clients[self._current_key_index]
            try:
                kwargs = {
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": temperature,
                }
                if parse_json:
                    # Groq's JSON mode requires the word "json" to appear in the
                    # prompt; both structured prompts above say "valid JSON".
                    kwargs["response_format"] = {"type": "json_object"}

                response = client.chat.completions.create(**kwargs)
                content = response.choices[0].message.content
                if not content:
                    logger.warning(f"Groq (key #{self._current_key_index + 1}) returned empty content.")
                    return None if parse_json else ""

                return json.loads(content) if parse_json else content.strip()

            except Exception as e:
                error_str = str(e).lower()
                logger.error(
                    f"Groq API call failed (key #{self._current_key_index + 1}, "
                    f"model={self.model_name}): {type(e).__name__} - {error_str}"
                )

                # A decommissioned/misspelled model id is a config error, not a
                # transient one - rotating keys cannot fix it, so fail fast and
                # say so plainly rather than burning every key on the same 404.
                if "404" in error_str or "does not exist" in error_str or "not found" in error_str:
                    logger.critical(
                        f"Groq model '{self.model_name}' was rejected as unknown. "
                        "Set GROQ_MODEL_NAME to a current production model "
                        "(see https://console.groq.com/docs/models). AI feedback is disabled until fixed."
                    )
                    return None if parse_json else ""

                is_rate_limit = "429" in error_str or "rate limit" in error_str or "rate_limit" in error_str
                if is_rate_limit and len(self._clients) > 1:
                    self._rotate_key()
                    logger.warning(f"Groq key rate-limited, rotating to key #{self._current_key_index + 1}")
                    tried += 1
                    continue
                return None if parse_json else ""

        logger.error("All Groq API keys exhausted (rate-limited).")
        self._current_key_index = start_index
        return None if parse_json else ""

    def chat_json(self, system_prompt: str, user_content: str, temperature: float = 0.1) -> Optional[Dict[str, Any]]:
        return self._execute_with_rotation(system_prompt, user_content, temperature, parse_json=True)

    def chat_text(self, system_prompt: str, user_content: str, temperature: float = 0.4) -> str:
        result = self._execute_with_rotation(system_prompt, user_content, temperature, parse_json=False)
        return result if result else ""


# ===========================================================================
# Public LLMService — provider-agnostic facade
# ===========================================================================

class LLMService:
    def __init__(self):
        provider = settings.LLM_PROVIDER.lower().strip()
        if provider == "gemini":
            self._backend = _GeminiBackend()
        elif provider == "ollama":
            self._backend = _OllamaBackend()
        elif provider == "groq":
            self._backend = _GroqBackend()
        else:
            raise ValueError(
                f"Unknown LLM_PROVIDER '{provider}'. Must be 'ollama', 'gemini', or 'groq'."
            )

    def extract_resume_data(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Extracts structured JSON from raw resume text using the configured LLM provider.
        """
        return self._backend.chat_json(_RESUME_SYSTEM_PROMPT, raw_text, temperature=0.1)

    def extract_job_description_data(self, raw_text: str) -> Optional[Dict[str, Any]]:
        """
        Extracts structured JSON from raw job description text.
        Matches the CompanyBase schema.
        """
        return self._backend.chat_json(_JD_SYSTEM_PROMPT, raw_text, temperature=0.1)

    def generate_gap_analysis(self, resume_text: str, jd_text: str, match_result: Dict[str, Any]) -> str:
        """
        Generates a qualitative, natural language gap analysis explaining why the candidate 
        is or isn't a fit for the role, providing skill justification and improvement suggestions.
        """
        system_prompt = _build_gap_analysis_system_prompt(match_result)
        user_content = f"JOB DESCRIPTION:\n{jd_text}\n\nRESUME:\n{resume_text}"
        result = self._backend.chat_text(system_prompt, user_content, temperature=0.4)
        return result if result else "Unable to generate AI gap analysis at this time."

    def generate_general_ats_feedback(self, resume_text: str, score_data: Dict[str, Any]) -> str:
        """
        Generates qualitative feedback for the general ATS score.
        """
        system_prompt = _build_ats_feedback_system_prompt(score_data)
        user_content = f"RESUME TEXT:\n{resume_text}"
        result = self._backend.chat_text(system_prompt, user_content, temperature=0.4)
        return result if result else "Unable to generate general ATS feedback at this time."

_llm_service_instance: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    """Singleton accessor for LLMService."""
    global _llm_service_instance
    if _llm_service_instance is None:
        _llm_service_instance = LLMService()
    return _llm_service_instance
