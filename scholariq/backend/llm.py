"""Talks to LM Studio's local server (OpenAI-compatible API on port 1234)."""
import os
from openai import OpenAI

BASE_URL = os.getenv("LMSTUDIO_URL", "http://localhost:1234/v1")
client = OpenAI(base_url=BASE_URL, api_key="lm-studio")  # key is ignored by LM Studio

_chat_model = os.getenv("CHAT_MODEL")
_embed_model = os.getenv("EMBED_MODEL")


def _resolve():
    """Pick the models automatically from what LM Studio reports."""
    global _chat_model, _embed_model
    ids = [m.id for m in client.models.list().data]
    if not _chat_model:
        _chat_model = next((i for i in ids if "embed" not in i.lower()), None)
    if not _embed_model:
        _embed_model = next((i for i in ids if "embed" in i.lower()), None)
    if not _chat_model or not _embed_model:
        raise RuntimeError(
            f"Need a chat model AND an embedding model in LM Studio. Found: {ids}")


def models():
    _resolve()
    return {"chat": _chat_model, "embed": _embed_model}


def embed(texts):
    _resolve()
    r = client.embeddings.create(model=_embed_model, input=texts)
    return [d.embedding for d in r.data]


def chat(messages, temperature=0.2):
    _resolve()
    r = client.chat.completions.create(
        model=_chat_model, messages=messages, temperature=temperature)
    return r.choices[0].message.content or ""
