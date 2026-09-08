import logging

logger = logging.getLogger(__name__)

# Lazy-loaded spaCy model singleton.  Previously this was loaded at import
# time which blocked uvicorn from binding its port on low-CPU hosts (Render
# free tier).  Now the model is loaded on first access via get_nlp().
_nlp = None

MODEL_NAME = "en_core_web_sm"


def get_nlp():
    """Return the shared spaCy model, loading it on first call."""
    global _nlp
    if _nlp is None:
        import spacy
        logger.info(f"Loading spaCy model {MODEL_NAME} …")
        try:
            _nlp = spacy.load(MODEL_NAME)
        except OSError as e:
            # Deliberately NOT downloading here. This runs inside a live request,
            # and shelling out to `spacy download` mid-request means an
            # unbounded network fetch on the request path - which fails badly on
            # a container with no egress, a read-only filesystem, or a request
            # deadline, and can fire concurrently from several workers at once.
            # The Dockerfile installs this model at build time and verifies it
            # loads, so reaching this branch means the environment is broken and
            # should say so loudly rather than trying to self-repair.
            raise RuntimeError(
                f"spaCy model '{MODEL_NAME}' is not installed. "
                f"Install it once with:  python -m spacy download {MODEL_NAME}"
            ) from e
        logger.info("spaCy model loaded.")
    return _nlp

