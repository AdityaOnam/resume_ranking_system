import os
import requests
import re
import math
from typing import List, Dict, Any, Optional, Set
import logging

logger = logging.getLogger(__name__)

# Map GitHub language names to canonical skill names
LANGUAGE_TO_SKILL = {
    "python": "Python",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "c++": "C++",
    "c": "C++",          # Merged with C++ for simplicity in resume contexts
    "java": "Java",
    "go": "Go",
    "rust": "Rust",
    "ruby": "Ruby",
    "php": "PHP",
    "swift": "Swift",
    "kotlin": "Kotlin",
    "html": "HTML",
    "css": "CSS",
    "shell": "Shell",
    "dockerfile": "Docker",
    "jupyter notebook": "Python",
    "dart": "Dart",
    "r": "R",
    "scala": "Scala",
    "lua": "Lua",
}

README_SKILL_PATTERNS = [
    "FastAPI", "Flask", "Django", "React", r"Next\.js", "Express",
    "MongoDB", "PostgreSQL", "MySQL", "Redis", "Firebase",
    "Docker", "Kubernetes", "AWS", "GCP", "Azure",
    "TensorFlow", "PyTorch", "Keras", "scikit-learn", "sklearn",
    "LangChain", "OpenAI", r"Hugging\s*Face", "Transformers",
    "Pandas", "NumPy", "Matplotlib", "Seaborn",
    r"Node\.js", r"Socket\.io", "WebSocket",
    "Streamlit", "Gradio", "Tailwind", "Bootstrap",
    "NLTK", "spaCy", "BERT", "GPT", "LLM",
    "Selenium", "BeautifulSoup", "Scrapy",
    "Git", "CI/CD", "GitHub Actions",
    "REST", "GraphQL", "gRPC",
    "Pydantic", "SQLAlchemy", "Prisma",
]

README_DISPLAY_NAMES = {
    r"Next\.js": "Next.js",
    r"Node\.js": "Node.js",
    r"Socket\.io": "Socket.io",
    r"Hugging\s*Face": "Hugging Face",
    "sklearn": "scikit-learn",
    "scikit-learn": "scikit-learn",
}

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculates the Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

class GitHubService:
    def __init__(self):
        # We fetch the GITHUB_TOKEN if available, otherwise it falls back to unauthenticated (free tier)
        self.token = os.environ.get("GITHUB_TOKEN")
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    def extract_github_data(self, github_url: str, resume_projects: List[Dict[str, Any]], embedded_links: List[str] = None) -> Dict[str, Any]:
        """
        Main entry point for GitHub extraction.
        Takes the user's GitHub URL and the projects extracted from the resume.
        """
        username = self._parse_username(github_url)
        if not username:
            return {"error": "Invalid GitHub URL"}

        # 1. Fetch repos
        repos = self._fetch_repos(username)
        if not repos:
            return {"error": "No public repositories found or rate limit exceeded"}

        # 2. Fetch language breakdown per repo
        repo_languages = self._fetch_per_repo_languages(username, repos)

        # 3. Aggregate languages
        language_stats = self._aggregate_languages(repos, repo_languages)

        # 4. Extract skills from READMEs of matching projects
        project_titles = [p.get("title", "") for p in resume_projects if p.get("title")]
        readme_skills = self._extract_skills_from_matched_readmes(username, repos, project_titles, embedded_links or [])

        return {
            "username": username,
            "total_repos": len(repos),
            "language_stats": language_stats,
            "readme_skills": list(readme_skills),
            "matched_projects": len(readme_skills) > 0
        }

    def _parse_username(self, url: str) -> Optional[str]:
        match = re.search(r"github\.com/([a-zA-Z0-9_-]+)", url)
        return match.group(1) if match else None

    def _fetch_repos(self, username: str, max_pages: int = 3) -> List[Dict]:
        all_repos = []
        for page in range(1, max_pages + 1):
            try:
                resp = requests.get(
                    f"https://api.github.com/users/{username}/repos",
                    params={"per_page": 100, "page": page, "sort": "updated"},
                    timeout=10,
                    headers=self.headers
                )
                if resp.status_code != 200:
                    if resp.status_code == 403:
                        logger.warning("GitHub API rate limit exceeded.")
                    break
                repos = resp.json()
                if not repos:
                    break
                all_repos.extend(repos)
            except Exception as e:
                logger.error(f"Error fetching repos: {e}")
                break
        return all_repos

    def _fetch_per_repo_languages(self, username: str, repos: List[Dict]) -> Dict[str, Dict[str, int]]:
        repo_langs = {}
        for repo in repos:
            repo_name = repo.get("name", "")
            try:
                resp = requests.get(
                    f"https://api.github.com/repos/{username}/{repo_name}/languages",
                    timeout=10,
                    headers=self.headers
                )
                if resp.status_code == 200:
                    repo_langs[repo_name] = resp.json()
                else:
                    repo_langs[repo_name] = {}
            except Exception:
                repo_langs[repo_name] = {}
        return repo_langs

    def _aggregate_languages(self, repos: List[Dict], repo_languages: Dict[str, Dict[str, int]]) -> List[Dict]:
        """Calculates the percentage of code written in each language across all repos."""
        lang_bytes = {}
        
        for repo in repos:
            repo_name = repo.get("name", "")
            languages = repo_languages.get(repo_name, {})
            
            for lang, bcount in languages.items():
                canonical = LANGUAGE_TO_SKILL.get(lang.lower(), lang)
                lang_bytes[canonical] = lang_bytes.get(canonical, 0) + bcount
                
        total_bytes = sum(lang_bytes.values())
        if total_bytes == 0:
            return []
            
        stats = []
        for lang, count in lang_bytes.items():
            percentage = round((count / total_bytes) * 100, 1)
            stats.append({
                "language": lang,
                "percentage": percentage,
                "bytes": count
            })
            
        return sorted(stats, key=lambda x: x["percentage"], reverse=True)

    def _extract_skills_from_matched_readmes(self, username: str, repos: List[Dict], resume_projects: List[str], embedded_links: List[str]) -> Set[str]:
        readme_skills = set()
        matched_repos = []
        repo_names = [r.get("name", "") for r in repos]
        
        # 1. Exact match from embedded links (icons/hyperlinks)
        for link in embedded_links:
            match = re.search(fr"github\.com/{username}/([a-zA-Z0-9_-]+)", link, re.IGNORECASE)
            if match:
                exact_repo = match.group(1)
                for repo_name in repo_names:
                    if repo_name.lower() == exact_repo.lower():
                        matched_repos.append(repo_name)
                        break
        
        # 2. Fuzzy match project names
        for proj_name in resume_projects:
            best_match = None
            best_dist = float("inf")
            
            for repo_name in repo_names:
                norm_proj = re.sub(r"[-_\s]+", "", proj_name.lower())
                norm_repo = re.sub(r"[-_\s]+", "", repo_name.lower())
                
                dist = levenshtein_distance(norm_proj, norm_repo)
                is_substring = norm_proj in norm_repo or norm_repo in norm_proj
                
                if dist < best_dist:
                    best_dist = dist
                    best_match = repo_name
                
                if is_substring:
                    best_match = repo_name
                    best_dist = 0
                    break
            
            threshold = max(3, int(len(proj_name) * 0.4))
            if best_match and best_dist <= threshold:
                matched_repos.append(best_match)
                
        for repo_name in set(matched_repos):
            readme_text = self._fetch_readme(username, repo_name)
            if readme_text:
                for pattern in README_SKILL_PATTERNS:
                    display = README_DISPLAY_NAMES.get(pattern, pattern.replace("\\", ""))
                    if re.search(r"\b" + pattern + r"\b", readme_text, re.IGNORECASE):
                        readme_skills.add(display)
                        
        return readme_skills

    def _fetch_readme(self, username: str, repo_name: str) -> Optional[str]:
        try:
            # Note: We use a different Accept header for READMEs to get raw text
            headers = self.headers.copy()
            headers["Accept"] = "application/vnd.github.v3.raw"
            resp = requests.get(
                f"https://api.github.com/repos/{username}/{repo_name}/readme",
                timeout=10,
                headers=headers
            )
            if resp.status_code == 200:
                return resp.text[:5000]
        except Exception:
            pass
        return None
