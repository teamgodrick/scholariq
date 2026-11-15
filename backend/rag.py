"""Prof. Pilot: Privacy-first local RAG study assistant powered by Llama 3.2 8B + nomic-embed."""
import json
import re
import numpy as np
from pypdf import PdfReader
import db
import llm

SYSTEM_ANSWER = (
    "You are Prof. Pilot, the elite academic study copilot inside ScholarIQ. "
    "You answer questions ONLY using the verified context extracted from the student's own uploaded notes. "
    "If the answer cannot be deduced from the provided context, clearly state: "
    "'I could not find this in your uploaded syllabus or notes.' "
    "Always cite the document and page number in parentheses, like (DBMS_Unit1.pdf, p.4). "
    "Format with clear headings, bullet points, and high readability."
)

SYSTEM_SUMMARY = (
    "You are Prof. Pilot. Provide a high-yield, structured academic revision summary "
    "from the provided context. Include: Key Definitions, Core Theorems/Principles, "
    "Important Formulas or Steps, and Typical Exam Traps/Pointers. Be crisp and academic."
)

SYSTEM_VIVA = (
    "You are a rigorous but supportive Engineering Professor conducting a Viva Voce (oral examination). "
    "Based strictly on the student's notes, generate a conceptual viva question followed by: "
    "1) What a stellar answer should mention (Key Points), "
    "2) A follow-up counter-question to test deep understanding."
)


def _clean_extracted_text(text):
    """Deep clean extracted PDF text to avoid stuttered repetitive artifacts."""
    if not text:
        return ""
    # Remove null bytes and non-printable control chars
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    # Collapse multiple consecutive identical words (e.g. 'Holiday Holiday Holiday Holiday' -> 'Holiday')
    text = re.sub(r'\b(\w+)(?:\s+\1\b){2,}', r'\1', text, flags=re.IGNORECASE)
    # Collapse identical short phrases repeated (e.g. 'Guru Nanak Jayanti Holiday: Guru Nanak Jayanti Holiday:')
    text = re.sub(r'(\b[A-Za-z0-9\s]{3,30}:)(?:\s*\1){2,}', r'\1', text, flags=re.IGNORECASE)
    # Normalize excessive spaces and tabs
    text = re.sub(r'[ \t]+', ' ', text)
    # Collapse 3+ newlines into 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def chunk_text(text, size=1500, overlap=300):
    """Split text into overlapping chunks for RAG indexing with deduplication."""
    text = _clean_extracted_text(text)
    out, i = [], 0
    seen = set()
    while i < len(text):
        chunk = text[i:i + size].strip()
        if chunk:
            # Check near-duplicate signature
            sig = re.sub(r'\s+', ' ', chunk.lower())[:160]
            if sig not in seen:
                seen.add(sig)
                out.append(chunk)
        i += size - overlap
    return out


def ingest_pdf(path, doc_name):
    reader = PdfReader(path)
    pieces = []
    for page_no, page in enumerate(reader.pages, start=1):
        raw = page.extract_text() or ""
        cleaned = _clean_extracted_text(raw)
        for ch in chunk_text(cleaned):
            if len(ch.strip()) > 35:
                pieces.append((page_no, ch))
    if not pieces:
        return 0

    # Cross-page deduplication
    seen = set()
    unique_pieces = []
    for page_no, text in pieces:
        sig = re.sub(r'\s+', ' ', text.lower().strip())[:160]
        if sig not in seen:
            seen.add(sig)
            unique_pieces.append((page_no, text))
    pieces = unique_pieces

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
        c.execute(
            """INSERT INTO documents(filename, chunks_count, file_size, uploaded_at)
               VALUES(?,?,?,CURRENT_TIMESTAMP)
               ON CONFLICT(filename) DO UPDATE SET chunks_count=excluded.chunks_count, uploaded_at=CURRENT_TIMESTAMP""",
            (doc_name, len(rows), 0),
        )
    return len(rows)


def list_documents():
    with db.conn() as c:
        docs = c.execute(
            "SELECT doc, COUNT(*) as chunks, MAX(page) as pages FROM chunks GROUP BY doc"
        ).fetchall()
        return [{"doc": d["doc"], "chunks": d["chunks"], "pages": d["pages"]} for d in docs]


def delete_document(doc_name):
    with db.conn() as c:
        c.execute("DELETE FROM chunks WHERE doc=?", (doc_name,))
        c.execute("DELETE FROM documents WHERE filename=?", (doc_name,))
    return {"deleted": doc_name}


def search(question, k=6):
    with db.conn() as c:
        rows = c.execute("SELECT doc,page,text,emb FROM chunks").fetchall()
    if not rows:
        return []
    q = np.array(llm.embed(["search_query: " + question])[0], dtype=np.float32)
    q /= np.linalg.norm(q) + 1e-9
    mat = np.vstack([np.frombuffer(r["emb"], dtype=np.float32) for r in rows])
    mat = mat / (np.linalg.norm(mat, axis=1, keepdims=True) + 1e-9)
    scores = mat @ q
    top = np.argsort(-scores)[:k * 2]

    # Deduplicate search results
    results = []
    seen = set()
    for i in top:
        text = rows[i]["text"]
        sig = re.sub(r'\s+', ' ', text.lower().strip())[:140]
        if sig not in seen:
            seen.add(sig)
            results.append({
                "doc": rows[i]["doc"],
                "page": rows[i]["page"],
                "text": text,
                "score": float(scores[i]),
            })
            if len(results) >= k:
                break

    return results


def answer(question):
    hits = search(question, k=5)
    if not hits:
        return {
            "answer": (
                "No syllabus or notes have been uploaded yet. "
                "Drop your course syllabus, lecture slides, or lab manuals to activate Prof. Pilot!"
            ),
            "sources": [],
        }

    context_parts = []
    for h in hits:
        clean_chunk = _clean_extracted_text(h['text'])
        context_parts.append(f"[{h['doc']} p.{h['page']}]\n{clean_chunk}")
    context = "\n\n---\n\n".join(context_parts)

    reply = llm.chat([
        {"role": "system", "content": SYSTEM_ANSWER},
        {"role": "user", "content": f"Context from notes:\n{context}\n\nStudent Question: {question}"},
    ])
    sources = [
        {"doc": h["doc"], "page": h["page"], "snippet": _clean_extracted_text(h["text"])[:220], "score": round(h["score"], 3)}
        for h in hits
    ]
    return {"answer": reply, "sources": sources}


def quiz(topic, n=4):
    hits = search(topic, k=5)
    if not hits:
        return {"quiz": "Please upload your course notes first to generate quizzes."}
    context = "\n\n---\n\n".join(_clean_extracted_text(h["text"]) for h in hits)
    text = llm.chat([
        {"role": "system", "content": "You create high-yield exam practice questions and solutions."},
        {
            "role": "user",
            "content": (
                f"Using ONLY the provided material, craft {n} challenging college exam questions "
                f"with clear, concise model answers on '{topic}'. Include marks weighting (e.g. [5 Marks]).\n\n"
                f"Context:\n{context}"
            ),
        },
    ], temperature=0.3)
    return {"quiz": text}


def summary(topic):
    hits = search(topic, k=5)
    if not hits:
        return {"summary": "Upload notes to generate a topic summary."}
    context = "\n\n---\n\n".join(_clean_extracted_text(h["text"]) for h in hits)
    text = llm.chat([
        {"role": "system", "content": SYSTEM_SUMMARY},
        {
            "role": "user",
            "content": f"Synthesize a rapid revision summary on topic '{topic}' using only:\n\n{context}",
        },
    ], temperature=0.2)
    return {"summary": text}


def viva_practice(topic):
    hits = search(topic, k=4)
    if not hits:
        return {"viva": "Upload notes to start viva practice."}
    context = "\n\n---\n\n".join(_clean_extracted_text(h["text"]) for h in hits)
    text = llm.chat([
        {"role": "system", "content": SYSTEM_VIVA},
        {
            "role": "user",
            "content": f"Generate a Viva Voce practice session on '{topic}' based on:\n\n{context}",
        },
    ], temperature=0.35)
    return {"viva": text}


def generate_flashcards(topic, n=4):
    hits = search(topic, k=4)
    if not hits:
        return {"flashcards": []}
    context = "\n\n---\n\n".join(_clean_extracted_text(h["text"]) for h in hits)
    prompt = (
        f"Generate {n} high-yield revision flashcards on '{topic}' from this text. "
        "Return ONLY a valid JSON array of objects with 'question' and 'answer' keys. "
        "Keep each question and answer concise and sharp.\n\n"
        f"Context:\n{context}\n\nFormat:\n[{{\"question\": \"...\", \"answer\": \"...\"}}]"
    )
    raw = llm.chat([{"role": "user", "content": prompt}], temperature=0.2)
    match = re.search(r"\[\s*\{.*\}\s*\]", raw, re.DOTALL)
    cards = []
    if match:
        try:
            cards = json.loads(match.group(0))
        except Exception:
            cards = []
    if not cards:
        cards = [
            {"question": f"Key Concept of {topic}", "answer": f"Core principles discussed in uploaded notes on {topic}."},
            {"question": f"Practical Application of {topic}", "answer": "Demonstrated in lab assignments and textbook readings."},
        ]

    with db.conn() as c:
        for card in cards:
            c.execute(
                """INSERT INTO flashcards(doc, topic, question, answer, confidence)
                   VALUES(?,?,?,?,?)""",
                (hits[0]["doc"] if hits else "Notes", topic, card["question"], card["answer"], 0),
            )

    return {"flashcards": cards}
