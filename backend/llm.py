"""Talks to LM Studio's local server using only Python's standard library.

Models are chosen like this: environment variable, then the choice saved in Settings,
then automatic detection from what LM Studio reports.
"""
import base64
import json
import os
import re
import time
import urllib.error
import urllib.request

import db

BASE = os.environ.get("LMSTUDIO_URL", "http://localhost:1234/v1")
_cache = {"ids": [], "t": 0.0}
VISION_HINTS = ("vl", "vision", "llava", "gemma-3", "gemma3", "gemma-4", "gemma4", "pixtral",
                "minicpm-v", "qwen3.5", "qwen3-vl", "qwen2.5-vl", "idefics", "internvl", "ministral")


class LLMError(Exception):
    pass


def _call(path, payload=None, timeout=900, _retry=True):
    try:
        return _call_once(path, payload, timeout)
    except LLMError as e:
        if _retry and "Cannot reach" in str(e):
            time.sleep(1.5)  # one gentle retry for short hiccups
            return _call_once(path, payload, timeout)
        raise


def _call_once(path, payload=None, timeout=900):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={
        "Content-Type": "application/json", "Authorization": "Bearer lm-studio"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise LLMError(f"LM Studio returned an error ({e.code}): {e.read()[:300].decode('utf-8', 'replace')}")
    except Exception:
        raise LLMError("Cannot reach LM Studio. Open LM Studio, load a model and turn the server on (port 1234).")


def model_ids(refresh=False):
    if refresh or not _cache["ids"] or time.time() - _cache["t"] > 20:
        _cache["ids"] = [m["id"] for m in _call("/models", timeout=10).get("data", [])]
        _cache["t"] = time.time()
    return _cache["ids"]


def _is_vision(model_id):
    return any(h in model_id.lower() for h in VISION_HINTS)


def pick(kind):
    ids = model_ids()
    want = os.environ.get(kind.upper() + "_MODEL") or db.get_setting(kind + "_model", "")
    if want and want in ids:
        return want
    plain = [i for i in ids if "embed" not in i.lower()]
    if kind == "embed":
        return next((i for i in ids if "embed" in i.lower()), None)
    if kind == "chat":
        return plain[0] if plain else None
    chat_model = pick("chat")
    if chat_model and _is_vision(chat_model):
        return chat_model
    return next((i for i in plain if _is_vision(i)), None)


def status():
    try:
        ids = model_ids(refresh=True)
        chat_m = pick("chat")
        if not chat_m:
            raise LLMError("No chat model found in LM Studio. Load your chat model.")
        return {"ok": True, "chat": chat_m, "embed": pick("embed"), "embed_ready": bool(pick("embed")),
                "vision": pick("vision"), "models": ids}
    except LLMError as e:
        return {"ok": False, "error": str(e), "models": []}


def _strip(text):
    return re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()


def chat(messages, temperature=0.3):
    m = pick("chat")
    if not m:
        raise LLMError("No chat model found in LM Studio. Load your chat model.")
    out = _call("/chat/completions", {"model": m, "messages": messages, "temperature": temperature})
    return _strip(out["choices"][0]["message"].get("content", ""))


def embed(texts):
    m = pick("embed")
    if not m:
        raise LLMError("No embedding model found. Load the nomic embedding model in LM Studio.")
    out = _call("/embeddings", {"model": m, "input": texts})
    return [d["embedding"] for d in sorted(out["data"], key=lambda d: d.get("index", 0))]


def vision(prompt, image_bytes, mime="image/png"):
    m = pick("vision")
    if not m:
        raise LLMError("No vision model found. In LM Studio download a model with the Vision tag "
                       "(for example Qwen3-VL or Gemma) and pick it in Settings.")
    url = f"data:{mime};base64,{base64.b64encode(image_bytes).decode()}"
    out = _call("/chat/completions", {"model": m, "temperature": 0.1, "messages": [{"role": "user", "content": [
        {"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": url}}]}]})
    return _strip(out["choices"][0]["message"].get("content", ""))


def parse_json(raw):
    text = _strip(raw).replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    starts = [i for i in (text.find("["), text.find("{")) if i != -1]
    if starts:
        s = min(starts)
        e = text.rfind("]" if text[s] == "[" else "}")
        if e > s:
            try:
                return json.loads(text[s:e + 1])
            except ValueError:
                pass
    raise ValueError("The AI did not return valid data. Press the button again.")


def chat_json(messages, temperature=0.3):
    """Ask for JSON; if the model rambles or breaks the format, ask once more, strictly."""
    first = chat(messages, temperature)
    try:
        return parse_json(first)
    except ValueError:
        fix = messages + [{"role": "assistant", "content": first[:1500]},
                          {"role": "user", "content": "That was not valid JSON. Reply again with ONLY the valid JSON, nothing else."}]
        return parse_json(chat(fix, 0))


def _drop_think(pieces):
    open_tag, close_tag, buf, inside = "<think>", "</think>", "", False
    for p in pieces:
        buf += p
        while True:
            if inside:
                j = buf.find(close_tag)
                if j == -1:
                    buf = buf[-len(close_tag):]
                    break
                buf, inside = buf[j + len(close_tag):], False
            else:
                i = buf.find(open_tag)
                if i == -1:
                    keep = next((n for n in range(min(len(open_tag) - 1, len(buf)), 0, -1) if open_tag.startswith(buf[-n:])), 0)
                    if len(buf) > keep:
                        yield buf[:len(buf) - keep]
                    buf = buf[len(buf) - keep:]
                    break
                if i > 0:
                    yield buf[:i]
                buf, inside = buf[i + len(open_tag):], True
    if not inside and buf:
        yield buf


def chat_stream(messages, temperature=0.3):
    """Yield the answer piece by piece, so the screen can show it as it is written."""
    m = pick("chat")
    if not m:
        raise LLMError("No chat model found in LM Studio. Load your chat model.")
    req = urllib.request.Request(BASE + "/chat/completions", data=json.dumps(
        {"model": m, "messages": messages, "temperature": temperature, "stream": True}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer lm-studio"})

    def raw():
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                for line in r:
                    line = line.strip()
                    if not line.startswith(b"data:"):
                        continue
                    body = line[5:].strip()
                    if body == b"[DONE]":
                        return
                    try:
                        delta = json.loads(body)["choices"][0].get("delta", {}).get("content")
                    except (ValueError, KeyError, IndexError):
                        continue
                    if delta:
                        yield delta
        except urllib.error.HTTPError as e:
            raise LLMError(f"LM Studio returned an error ({e.code}): {e.read()[:300].decode('utf-8', 'replace')}")
        except LLMError:
            raise
        except Exception:
            raise LLMError("Cannot reach LM Studio. Open LM Studio, load a model and turn the server on (port 1234).")
    yield from _drop_think(raw())
