"""Prof. Pilot's brain: hybrid search (keywords + meaning), grounded answers, library, self-test."""
import hashlib
import math
import operator
import os
import random
import re
from array import array
from collections import Counter

import db
import llm
import readers

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIBRARY = os.path.join(ROOT, "library")
DESCRIBE_PROMPT = ("Describe this image for a student's study notes. If it is a flowchart or diagram, list every box "
                   "or step in order and every arrow as 'A -> B' (include arrow labels such as Yes/No). If it is a slide "
                   "or page, transcribe all visible text and summarise any chart or table. If it is handwriting, "
                   "transcribe it. Be accurate and do not invent anything.")
STOP = set("a an the of to in and or is are was were be for on with as by at from that this it its into than then which "
           "what who how why when where do does did can could should would will may might not no you your i we they "
           "them their our us about explain tell me give".split())
_IDX = {"sig": None}
_SUMMARIES = {}
BUDGETS = {"small": {"ctx": 3200, "hist": 1500, "k": 4}, "medium": {"ctx": 7000, "hist": 3500, "k": 6}, "large": {"ctx": 15000, "hist": 8000, "k": 8}}
try:
    if os.environ.get("SCHOLARIQ_NO_NUMPY"):
        raise ImportError
    import numpy as np
except Exception:
    np = None


def toks(text):
    out = []
    for w in re.findall(r"[a-z0-9]+", text.lower()):
        if w in STOP or len(w) < 2:
            continue
        for suf in ("ing", "es", "s"):
            if len(w) > 4 and w.endswith(suf):
                w = w[:-len(suf)]
                break
        out.append(w)
    return out


def chunk_text(text, size=700, overlap=120):
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]
    out, cur = [], ""
    for s in sents:
        if cur and len(cur) + len(s) + 1 > size:
            out.append(cur)
            tail = cur[-overlap:]
            cur = tail[tail.find(" ") + 1:] if " " in tail else tail
        cur = (cur + " " + s).strip()
        while len(cur) > size * 1.6:
            out.append(cur[:size])
            cur = cur[size - overlap:]
    if cur and (not out or cur not in out[-1]):
        out.append(cur)
    return [c for c in out if len(c) > 25]


def _num(label):
    m = re.search(r"\d+", label or "")
    return int(m.group()) if m else 0


def ingest_file(name, data, vision=False):
    is_img = name.lower().endswith(tuple(readers.IMG))
    describe = (lambda b, mime: llm.vision(DESCRIBE_PROMPT, b, mime)) if (vision or is_img) else None
    pieces = [(label, ch) for label, text in readers.read_file(name, data, describe) for ch in chunk_text(text)]
    if not pieces:
        raise ValueError("No readable text found in this file.")
    embs, embedded = [None] * len(pieces), True
    try:
        for i in range(0, len(pieces), 16):
            batch = [f"search_document: {name} {l}. {c}" for l, c in pieces[i:i + 16]]
            for j, e in enumerate(llm.embed(batch)):
                embs[i + j] = e
    except llm.LLMError:
        embs, embedded = [None] * len(pieces), False  # keyword search still works; reembed() fixes it later
    db.run("DELETE FROM chunks WHERE doc=?", (name,))
    db.many("INSERT INTO chunks(doc,page,label,text,emb) VALUES(?,?,?,?,?)",
            [(name, _num(l), l, c, array("f", e).tobytes() if e else None) for (l, c), e in zip(pieces, embs)])
    _IDX["sig"] = None
    return {"doc": name, "sections": len(pieces), "embedded": embedded}


def reembed():
    rows = db.q("SELECT id, doc, label, text FROM chunks WHERE emb IS NULL")
    for i in range(0, len(rows), 16):
        batch = rows[i:i + 16]
        vecs = llm.embed([f"search_document: {r['doc']} {r['label']}. {r['text']}" for r in batch])
        db.many("UPDATE chunks SET emb=? WHERE id=?", [(array("f", v).tobytes(), r["id"]) for r, v in zip(batch, vecs)])
    _IDX["sig"] = None
    return len(rows)


def delete_doc(name):
    db.run("DELETE FROM chunks WHERE doc=?", (name,))
    _IDX["sig"] = None


def docs():
    return db.q("SELECT doc, COUNT(*) AS sections, SUM(CASE WHEN emb IS NULL THEN 1 ELSE 0 END) AS keyword_only "
                "FROM chunks GROUP BY doc ORDER BY doc")


def scan_library():
    os.makedirs(LIBRARY, exist_ok=True)
    have = {d["doc"] for d in docs()}
    added, errors = [], []
    for folder, _, files in os.walk(LIBRARY):
        for f in sorted(files):
            if os.path.splitext(f.lower())[1] not in readers.SUPPORTED or f.lower() == "readme.txt":
                continue
            name = os.path.relpath(os.path.join(folder, f), LIBRARY).replace("\\", "/")
            if name in have:
                continue
            try:
                with open(os.path.join(folder, f), "rb") as fh:
                    added.append(ingest_file(name, fh.read())["doc"])
            except (ValueError, llm.LLMError) as e:
                errors.append(f"{name}: {e}")
    fixed = 0
    try:
        fixed = reembed()
    except llm.LLMError:
        pass
    return {"added": added, "errors": errors, "reindexed": fixed}


# ---------- search ----------
def _vec(blob):
    a = array("f")
    a.frombytes(blob)
    return a


def _index():
    sig = db.one("SELECT COUNT(*) AS c, COALESCE(MAX(id),0) AS m, SUM(emb IS NULL) AS n FROM chunks")
    key = (sig["c"], sig["m"], sig["n"])
    if _IDX["sig"] == key:
        return _IDX
    rows = db.q("SELECT id, doc, page, label, text, emb FROM chunks")
    tf, df, vec, norm = [], {}, [], []
    for r in rows:
        c = Counter(toks(f"{r['doc']} {r['label'] or ''} {r['text']}"))
        tf.append((c, sum(c.values())))
        for w in c:
            df[w] = df.get(w, 0) + 1
        v = _vec(r["emb"]) if r["emb"] else None
        vec.append(v)
        norm.append(math.sqrt(sum(x * x for x in v)) or 1.0 if v else 1.0)
    mat = None
    if np is not None and vec and all(v is not None for v in vec) and len({len(v) for v in vec}) == 1:
        try:
            mat = np.vstack([np.frombuffer(r["emb"], dtype=np.float32) for r in rows])
            mat = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
        except Exception:
            mat = None
    _IDX.update(sig=key, rows=rows, tf=tf, df=df, vec=vec, norm=norm, mat=mat,
                avgdl=(sum(t[1] for t in tf) / len(tf)) if tf else 1)
    return _IDX


def _rewrite(question, history):
    convo = "\n".join(f"{'Student' if m.get('role') == 'user' else 'Tutor'}: {str(m.get('text', ''))[:300]}" for m in history[-6:])
    try:
        out = llm.chat([{"role": "user", "content": "Rewrite the student's last question as ONE standalone search query, "
                         "replacing pronouns with the real topic. Reply with only the query.\n\n" + convo + "\nLast question: " + question}], temperature=0)
        return out.split("\n")[0].strip()[:300] or question
    except llm.LLMError:
        return question


def retrieve(question, k=6, docs=None, history=None):
    idx = _index()
    rows = idx["rows"]
    if not rows:
        return []
    q = _rewrite(question, history) if history else question
    allowed = {docs} if isinstance(docs, str) else (set(docs) if docs else None)
    cand = [i for i, r in enumerate(rows) if allowed is None or r["doc"] in allowed]
    if not cand:
        return []
    kw, n = {}, len(rows)
    for i in cand:
        tfc, dl = idx["tf"][i]
        s = 0.0
        for w in set(toks(q)):
            f = tfc.get(w, 0)
            if f:
                d = idx["df"][w]
                s += math.log(1 + (n - d + .5) / (d + .5)) * f * 2.5 / (f + 1.5 * (.25 + .75 * dl / idx["avgdl"]))
        if s > 0:
            kw[i] = s
    dense = {}
    try:
        qv = llm.embed(["search_query: " + q])[0]
        qn = math.sqrt(sum(x * x for x in qv)) or 1.0
        if idx["mat"] is not None and idx["mat"].shape[1] == len(qv):
            sc = idx["mat"] @ (np.array(qv, dtype=np.float32) / qn)
            dense = {i: float(sc[i]) for i in cand}
        else:
            for i in cand:
                v = idx["vec"][i]
                if v is not None and len(v) == len(qv):
                    dense[i] = sum(map(operator.mul, qv, v)) / (qn * idx["norm"][i])
    except llm.LLMError:
        pass
    fused = {}
    for ranking in (sorted(kw, key=lambda i: -kw[i])[:20], sorted(dense, key=lambda i: -dense[i])[:20]):
        for rank, i in enumerate(ranking):
            fused[i] = fused.get(i, 0) + 1 / (60 + rank)
    picked = []
    for i in sorted(fused, key=lambda i: -fused[i]):
        a = set(idx["tf"][i][0])
        if all(len(a & set(idx["tf"][j][0])) / max(1, len(a | set(idx["tf"][j][0]))) < .85 for j in picked):
            picked.append(i)
        if len(picked) >= k:
            break
    return [{"id": rows[i]["id"], "doc": rows[i]["doc"], "page": rows[i]["page"], "label": rows[i]["label"] or f"Page {rows[i]['page']}",
             "text": rows[i]["text"], "sim": dense.get(i)} for i in picked]


def pick(topic, k, exclude, docs=None):
    """Choose sections that were not used before, so repeated requests give new material."""
    if topic:
        hits = retrieve(topic, k=24, docs=docs)
        fresh = [h for h in hits if h["id"] not in exclude]
        return (fresh or hits)[:k], bool(fresh)
    allowed = {docs} if isinstance(docs, str) else (set(docs) if docs else None)
    rows = [r for r in _index()["rows"] if r["id"] not in exclude and (allowed is None or r["doc"] in allowed)]
    random.shuffle(rows)
    return [{"id": r["id"], "doc": r["doc"], "label": r["label"] or f"Page {r['page']}", "text": r["text"]} for r in rows[:k]], bool(rows)


# ---------- answering ----------
HYBRID = ("You are Prof. Pilot, a friendly expert tutor inside ScholarIQ. You receive CONTEXT taken from the student's own "
          "library. Rules: 1) If the context answers the question, answer from it and cite like (Slide 4, deck.pptx) or "
          "(Page 3, notes.pdf). 2) If the context is missing or covers only part of it, still help: give a correct answer from "
          "your own knowledge and start that part with 'Not in your notes, but generally:'. 3) Never invent a citation or claim "
          "the notes say something they do not. 4) Explain step by step with a short example when it helps. Stay focused.")
STRICT = ("You are Prof. Pilot, a study assistant. Answer ONLY from the CONTEXT taken from the student's notes and cite sources like "
          "(Slide 4, deck.pptx). If the answer is not in the context, say you could not find it in their material.")


def budget():
    return BUDGETS.get(db.get_setting("ai_memory", "small"), BUDGETS["small"])


def _memory(history, bud):
    """Keep the last few messages word for word and fold older ones into a short summary."""
    history = [m for m in (history or []) if m.get("text")][-24:]
    recent, older = history[-4:], history[:-4]
    summary = ""
    if older:
        key = hashlib.md5("|".join(m["text"][:80] for m in older).encode()).hexdigest()
        if key not in _SUMMARIES:
            convo = "\n".join(f"{'Student' if m.get('role') == 'user' else 'Tutor'}: {str(m['text'])[:300]}" for m in older)
            try:
                _SUMMARIES[key] = llm.chat([{"role": "user", "content": "Summarise this tutoring conversation in 3 short sentences: the "
                                             "topics covered and anything the student said about their level or goals.\n\n" + convo}], temperature=0)[:500]
            except llm.LLMError:
                _SUMMARIES[key] = ""
        summary = _SUMMARIES[key]
    msgs, used = [], 0
    for m in reversed(recent):
        text = str(m["text"])[:max(200, bud["hist"] // 4)]
        if used + len(text) > bud["hist"] and msgs:
            break
        used += len(text)
        msgs.append({"role": "user" if m.get("role") == "user" else "assistant", "content": text})
    return summary, msgs[::-1], recent


def prepare(question, history=None, mode="hybrid", docs=None):
    bud = budget()
    summary, recent_msgs, recent = _memory(history, bud)
    hits = retrieve(question, k=bud["k"], docs=docs, history=recent)
    parts, used = [], 0
    for h in hits:
        block = f"[{h['doc']}, {h['label']}]\n{h['text']}"
        if used + len(block) > bud["ctx"] and parts:
            break
        parts.append(block)
        used += len(block)
    hits = hits[:len(parts)]
    context = "\n\n".join(parts) or "(the library is empty)"
    system = STRICT if mode == "notes" else HYBRID
    if summary:
        system += "\nEarlier in this conversation: " + summary
    msgs = [{"role": "system", "content": system}] + recent_msgs
    msgs.append({"role": "user", "content": f"CONTEXT:\n{context}\n\nQUESTION: {question}"})
    return msgs, hits, context


def _finish(reply, hits):
    from_notes = bool(hits) and not reply.strip().lower().startswith("not in your notes")
    return {"answer": reply, "from_notes": from_notes,
            "sources": [{"doc": h["doc"], "label": h["label"], "snippet": h["text"][:220]} for h in hits] if from_notes else []}


def verify(reply, context):
    try:
        d = llm.chat_json([{"role": "user", "content": f"CONTEXT:\n{context}\n\nANSWER:\n{reply}\n\nDoes the ANSWER state any fact as coming "
                            "from the notes that the CONTEXT does not support? Parts introduced with 'Not in your notes' are allowed. "
                            'Reply with ONLY JSON like {"ok": true, "problem": ""}.'}], temperature=0)
        return bool(d.get("ok", True)), str(d.get("problem", ""))[:200]
    except (ValueError, llm.LLMError, AttributeError):
        return True, ""


def answer(question, history=None, mode="hybrid", docs=None, careful=False):
    msgs, hits, context = prepare(question, history, mode, docs)
    reply = llm.chat(msgs, temperature=0.3)
    checked = fixed = False
    if careful and hits:
        checked = True
        ok, problem = verify(reply, context)
        if not ok:
            msgs[-1]["content"] += f"\n\nYour previous draft had a problem: {problem}. Rewrite it using only facts in the CONTEXT, or say clearly what is missing."
            reply, fixed = llm.chat(msgs, temperature=0.1), True
    out = _finish(reply, hits)
    out.update(checked=checked, fixed=fixed)
    return out


def stream_answer(question, history=None, mode="hybrid", docs=None):
    msgs, hits, _ = prepare(question, history, mode, docs)
    text = ""
    for piece in llm.chat_stream(msgs, temperature=0.3):
        text += piece
        yield {"type": "token", "t": piece}
    yield dict(_finish(text.strip(), hits), type="done")


def quiz(topic, n=5, docs=None):
    rows = db.q("SELECT q FROM quiz_log ORDER BY id DESC LIMIT 30")
    used = {r["id"] for r in db.q("SELECT chunk_id AS id FROM used_chunks WHERE deck='__quiz__'")}
    hits, fresh = pick(topic, 4, used, docs)
    if not hits:
        raise ValueError("Upload or scan your notes first, or pick a different document.")
    ctx = "\n\n".join(h["text"] for h in hits)
    avoid = "\n".join("- " + r["q"] for r in rows)
    parsed = llm.chat_json([{"role": "user", "content": f"Using only this material, write {int(n)} varied exam questions (mix recall, "
                     f"understanding and application) about '{topic or 'these notes'}'. Reply with ONLY a JSON array like "
                     f'[{{"q": "question", "a": "short model answer"}}]. Do NOT repeat these earlier questions:\n{avoid or "(none)"}\n\nMATERIAL:\n{ctx}'}], temperature=0.8)
    items = [i for i in parsed if isinstance(i, dict) and i.get("q") and i.get("a")]
    if not items:
        raise ValueError("The AI made no usable questions. Try again.")
    db.many("INSERT INTO quiz_log(q) VALUES(?)", [(str(i["q"])[:300],) for i in items])
    db.many("INSERT OR IGNORE INTO used_chunks(deck, chunk_id) VALUES('__quiz__', ?)", [(h["id"],) for h in hits])
    return {"items": [{"q": str(i["q"]), "a": str(i["a"])} for i in items]}


def selftest(n=6):
    rows = _index()["rows"]
    if len(rows) < 3:
        raise ValueError("Upload or scan some documents first.")
    items, hits_n = [], 0
    for r in random.sample(rows, min(int(n), len(rows))):
        q = llm.chat([{"role": "user", "content": "Write ONE specific question that this passage answers. Reply with only the "
                       "question.\n\n" + r["text"][:700]}], temperature=0.2).strip().strip('"')
        found = retrieve(q, k=4)
        rank = next((i + 1 for i, h in enumerate(found) if h["id"] == r["id"]), None)
        hits_n += rank is not None
        items.append({"question": q, "source": f"{r['doc']}, {r['label'] or 'Page ' + str(r['page'])}", "rank": rank})
    return {"tested": len(items), "hits": hits_n, "hit_rate": round(hits_n / len(items) * 100), "items": items,
            "meaning_search": any(v is not None for v in _index()["vec"])}