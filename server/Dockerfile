FROM python:3.10-slim
LABEL org.opencontainers.image.title="Resume Ranking API"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/models/cache \
    SENTENCE_TRANSFORMERS_HOME=/app/models/cache \
    TRANSFORMERS_CACHE=/app/models/cache \
    MODEL_CACHE_DIR=/app/models/cache \
    HOME=/app

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download en_core_web_sm

# Download models WHILE we still have internet access
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2', cache_folder='/app/models/cache')"
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# NOW enable offline mode so runtime never hits HuggingFace
ENV TRANSFORMERS_OFFLINE=1 \
    HF_HUB_OFFLINE=1

COPY . .

EXPOSE 10000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
