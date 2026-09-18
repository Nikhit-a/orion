import logging
from typing import List
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_embedding(text: str) -> List[float]:
    """
    Returns a 1536-dim embedding for the given text using OpenAI's
    text-embedding-ada-002 model. Falls back to a zero vector when the
    API key is not configured (e.g. local dev without OpenAI access).
    """
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — returning zero embedding.")
        return [0.0] * 1536

    try:
        from langchain_openai import OpenAIEmbeddings
        embeddings = OpenAIEmbeddings(
            model="text-embedding-ada-002",
            api_key=settings.OPENAI_API_KEY,
        )
        return embeddings.embed_query(text)
    except Exception as e:
        logger.error("Embedding generation failed: %s", e)
        return [0.0] * 1536
