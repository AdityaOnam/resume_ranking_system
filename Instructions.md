# Team Collaboration & Workflow Instructions

Welcome to the **Resume Analyzer v2.0** repository! Since this project is maintained by a 2-person team (Full Stack Developer + AI/ML Developer), please adhere to the following rules to ensure a smooth workflow.

## 1. Secret Management 🔐
- **Never commit `.env` files**: Your `.env` files are ignored by Git. Keep them strictly on your local machine.
- **Use `.env.example`**: Whenever you introduce a new environment variable (e.g., a new database URL or API key), add the variable name to `.env.example` with a blank value. This tells the other developer that a new key is required.
- **Secure Sharing**: If you need to share a real API key or database password, use a secure channel (like 1Password, Bitwarden, or encrypted messaging). Do not send secrets in plain text over Slack or Discord.

## 2. Branching Strategy 🌿
Do not push code directly to the `main` branch. Use feature branches based on your role:
- **Full Stack Developer (Person 1)**: Prefix your branches with `feature/frontend-...` or `feature/backend-...` (e.g., `feature/backend-upload-api`).
- **AI/ML Developer (Person 2)**: Prefix your branches with `feature/ai-...` (e.g., `feature/ai-resume-parser`).

When a feature is complete, open a **Pull Request (PR)** so the other person can review the code before it merges into `main`.

## 3. API Contracts 🤝
Because the frontend depends on the backend, and the backend depends on the AI parser, **agree on the JSON structures first**. 
For example, agree that the parser will always return `{"skills": [], "education": []}`. This allows the Full Stack Developer to mock the data and build the frontend without waiting for the AI Developer to finish the complex machine learning logic.

## 4. Progress Tracking 📝
We use the `check_log.md` file in the root directory to track our progress across all 10 phases.
- When you begin a task, change `[ ]` to `[/]`.
- When your Pull Request is merged into `main`, change `[/]` to `[x]`.
