"""Prof. Pilot: read PDFs, store chunks, answer only from the student's notes."""
import numpy as np
from pypdf import PdfReader
import db
import llm

SYSTEM = (
    "You are Prof. Pilot, the study assistant inside ScholarIQ. Answer ONLY from the "
    "context taken from the student's own notes. If the answer is not in the context, "
    "say you could not find it in their material. Be clear and concise, and mention "
    "page numbers like (p.3)."
)


def chunk_text(text, size=900, overlap=150):
    text = " ".join(text.split())
    out, i = [], 0
    while i < len(text):
        out.append(text[i:i + size])
        i += size - overlap
    return out


def ingest_pdf(path, doc_name):
    reader = PdfReader(path)
    pieces = []
    for page_no, page in enumerate(reader.pages, start=1):
        for ch in chunk_text(page.extract_text() or ""):
            if len(ch) > 40:
                pieces.append((page_no, ch))
    if not pieces:
        return 0
    embs = []
    for i in range(0, len(pieces), 16):
        batch = ["search_document: " + p[1] for p in pieces[i:i + 16]]
        embs.extend(llm.embed(batch))
    rows = [
        (doc_name, p, t, np.array(e, dtype=np.float32).tobytes())
        for (p, t), e in zip(pieces, embs)
    ]
    with db.conn() as c:
        c.execute("DELETE FROM chunks WHERE doc=?", (doc_name,))
        c.executemany("INSERT INTO chunks(doc,page,text,emb) VALUES(?,?,?,?)", rows)
    return len(rows)


def search(question, k=4):
    with db.conn() as c:
        rows = c.execute("SELECT doc,page,text,emb FROM chunks").fetchall()
    if not rows:
        return []
    q = np.array(llm.embed(["search_query: " + question])[0], dtype=np.float32)
    q /= np.linalg.norm(q) + 1e-9
    mat = np.vstack([np.frombuffer(r["emb"], dtype=np.float32) for r in rows])
    mat = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
    scores = mat @ q
    top = np.argsort(-scores)[:k]
    return [
        {"doc": rows[i]["doc"], "page": rows[i]["page"],
         "text": rows[i]["text"], "score": float(scores[i])}
        for i in top
    ]


def answer(question):
    hits = search(question)
    if not hits:
        return {"answer": "No study material yet. Upload a syllabus or notes PDF first.",
                "sources": []}
    context = "\n\n".join(f"[{h['doc']} p.{h['page']}]\n{h['text']}" for h in hits)
    reply = llm.chat([
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
    ])
    sources = [{"doc": h["doc"], "page": h["page"], "snippet": h["text"][:220]} for h in hits]
    return {"answer": reply, "sources": sources}


def quiz(topic, n=5):
    hits = search(topic, k=5)
    if not hits:
        return {"quiz": "Upload your notes first."}
    context = "\n\n".join(h["text"] for h in hits)
    text = llm.chat([
        {"role": "system", "content": "You write exam practice questions from the notes given."},
        {"role": "user", "content": f"Using only this material, write {n} short exam questions "
                                    f"with one-line answers on '{topic}'.\n\n{context}"},
    ], temperature=0.4)
    return {"quiz": text}
