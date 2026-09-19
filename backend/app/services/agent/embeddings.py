import hashlib
import logging
import math
import re
from typing import List

from app.core.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1536


def local_embedding(text: str, dim: int = EMBEDDING_DIM) -> List[float]:
    """Deterministic hashed bag-of-words embedding used when OpenAI is unavailable."""
    vec = [0.0] * dim
    tokens = re.findall(r"[a-z0-9]+", (text or "").lower()) or ["empty"]
    for tok in tokens:
        digest = hashlib.sha256(tok.encode("utf-8")).digest()
        for i in range(0, 32, 4):
            idx = int.from_bytes(digest[i : i + 2], "little") % dim
            sign = 1.0 if digest[i + 2] % 2 == 0 else -1.0
            mag = (digest[i + 3] + 1) / 256.0
            vec[idx] += sign * mag
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def get_embedding(text: str) -> List[float]:
    """
    1536-dim embedding via OpenAI text-embedding-ada-002, falling back to a
    local hashed embedding so pgvector search still ranks related text.
    """
    if settings.OPENAI_API_KEY:
        try:
            from langchain_openai import OpenAIEmbeddings

            embeddings = OpenAIEmbeddings(
                model="text-embedding-ada-002",
                api_key=settings.OPENAI_API_KEY,
            )
            return embeddings.embed_query(text)
        except Exception as e:
            logger.error("Embedding generation failed: %s", e)

    logger.info("Using local hashed embedding (OpenAI key missing or call failed).")
    return local_embedding(text)
