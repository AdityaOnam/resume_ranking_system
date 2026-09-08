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

# Download models WHILE we still have internet access.
# Both MUST pass the same cache_folder the app uses at runtime
# (settings.MODEL_CACHE_DIR). cache_folder=X lays files out as
# X/models--org--name/, whereas falling back to HF_HOME writes to
# HF_HOME/hub/models--org--name/ - a different path. The CrossEncoder line
# previously omitted cache_folder, so at runtime it looked in the wrong
# directory, failed under HF_HUB_OFFLINE=1, and was silently caught, leaving
# cross-encoder scoring permanently disabled (30 of 100 match points always 0).
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2', cache_folder='/app/models/cache')"
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', cache_folder='/app/models/cache')"

# NOW enable offline mode so runtime never hits HuggingFace
ENV TRANSFORMERS_OFFLINE=1 \
    HF_HUB_OFFLINE=1

# Fail the build - not a live request - if either model can't be loaded from
# the baked cache in offline mode.
RUN python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('all-MiniLM-L6-v2', cache_folder='/app/models/cache'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', cache_folder='/app/models/cache'); \
import spacy; spacy.load('en_core_web_sm'); \
print('All models load correctly from the baked offline cache.')"

COPY . .

EXPOSE 10000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}
