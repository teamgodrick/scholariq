"""Turns many file types into plain text 'units' (pages, slides, sections) the AI can search.

PDF, PowerPoint (text, tables, speaker notes and flowchart arrows), Word, TXT, Markdown, CSV,
and pictures (flowcharts, slides, handwriting) when a vision model is available.
"""
import io
import os
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

try:
    from pypdf import PdfReader
except ImportError:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor"))
    from pypdf import PdfReader

A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
RELNS = "{http://schemas.openxmlformats.org/package/2006/relationships}"
IMG = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
TEXT = {".txt", ".md", ".csv", ".tsv", ".log", ".py", ".java", ".c", ".cpp", ".js", ".sql", ".json"}
SUPPORTED = {".pdf", ".pptx", ".docx"} | set(IMG) | TEXT


def _text(el, tag):
    return "".join(t.text or "" for t in el.iter(tag))


def _rels(z, path):
    try:
        root = ET.fromstring(z.read(path))
    except KeyError:
        return {}
    return {r.get("Id"): r.get("Target") for r in root.iter(RELNS + "Relationship")}


def read_pdf(data, describe=None):
    reader = PdfReader(io.BytesIO(data))
    units, seen = [], 0
    for n, page in enumerate(reader.pages, 1):
        text = (page.extract_text() or "").strip()
        if describe and seen < 8:
            try:
                for im in list(page.images)[:2]:
                    if len(im.data) > 8000:
                        seen += 1
                        text += "\nFigure on this page: " + describe(im.data, IMG.get(os.path.splitext(im.name)[1].lower(), "image/png"))
            except Exception:
                pass  # some embedded images cannot be decoded without extra libraries
        if text:
            units.append((f"Page {n}", text))
    return units


def read_pptx(data, describe=None):
    z = zipfile.ZipFile(io.BytesIO(data))
    slides = sorted((n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)),
                    key=lambda n: int(re.findall(r"\d+", n)[-1]))
    units, pics = [], 8
    for i, name in enumerate(slides, 1):
        root = ET.fromstring(z.read(name))
        shapes, lines = {}, []
        for sp in root.iter(P + "sp"):
            cnv = sp.find(f"{P}nvSpPr/{P}cNvPr")
            text = " ".join(t for t in (_text(p, A + "t").strip() for p in sp.iter(A + "p")) if t)
            if cnv is not None:
                shapes[cnv.get("id")] = text or cnv.get("name", "")
            if text:
                lines.append(text)
        for tr in root.iter(A + "tr"):
            cells = [_text(tc, A + "t").strip() for tc in tr.iter(A + "tc")]
            lines.append("Table row: " + " | ".join(c for c in cells if c))
        edges = []
        for cx in root.iter(P + "cxnSp"):
            st, en = cx.find(f".//{A}stCxn"), cx.find(f".//{A}endCxn")
            if st is not None and en is not None and shapes.get(st.get("id")) and shapes.get(en.get("id")):
                edges.append(f"{shapes[st.get('id')]} -> {shapes[en.get('id')]}")
        if edges:
            lines.append("Flowchart connections: " + "; ".join(edges))
        rels = _rels(z, f"ppt/slides/_rels/{posixpath.basename(name)}.rels")
        for tgt in rels.values():
            if "notesSlide" in tgt:
                try:
                    notes = ET.fromstring(z.read(posixpath.normpath(posixpath.join("ppt/slides", tgt))))
                    note = " ".join(t for t in (_text(p, A + "t").strip() for p in notes.iter(A + "p")) if t and not t.isdigit())
                    if note:
                        lines.append("Speaker notes: " + note)
                except KeyError:
                    pass
        if describe:
            for blip in root.iter(A + "blip"):
                path = posixpath.normpath(posixpath.join("ppt/slides", rels.get(blip.get(R + "embed"), "")))
                ext = posixpath.splitext(path)[1].lower()
                if ext in IMG and pics > 0 and path in z.namelist():
                    pics -= 1
                    lines.append("Picture on this slide: " + describe(z.read(path), IMG[ext]))
        if lines:
            units.append((f"Slide {i}", "\n".join(lines)))
    return units


def read_docx(data, describe=None):
    z = zipfile.ZipFile(io.BytesIO(data))
    body = ET.fromstring(z.read("word/document.xml")).find(W + "body")
    sections, cur = [], ["Introduction", []]
    for el in body:
        if el.tag == W + "p":
            style = el.find(f"{W}pPr/{W}pStyle")
            sv = (style.get(W + "val") or "") if style is not None else ""
            text = _text(el, W + "t").strip()
            if sv.lower().startswith(("heading", "title")) and text:
                sections.append(cur)
                cur = [text, []]
            elif text:
                cur[1].append(text)
        elif el.tag == W + "tbl":
            for tr in el.iter(W + "tr"):
                cells = [_text(tc, W + "t").strip() for tc in tr.iter(W + "tc")]
                cur[1].append("Table row: " + " | ".join(c for c in cells if c))
    sections.append(cur)
    return [(f"Section {i}: {h}"[:60], "\n".join(t)) for i, (h, t) in enumerate(sections, 1) if t]


def read_text(data, describe=None):
    text = data.decode("utf-8", "replace")
    units, cur, n = [], "", 1
    for para in re.split(r"\n\s*\n", text):
        if len(cur) + len(para) > 2500 and cur:
            units.append((f"Part {n}", cur))
            n, cur = n + 1, ""
        cur += para + "\n\n"
    if cur.strip():
        units.append((f"Part {n}", cur))
    return units


def read_file(name, data, describe=None):
    ext = os.path.splitext(name.lower())[1]
    if ext in IMG:
        if not describe:
            raise ValueError("Pictures need a vision model. Tick the picture option and pick a vision model in Settings.")
        return [("Image", describe(data, IMG[ext]))]
    reader = {".pdf": read_pdf, ".pptx": read_pptx, ".docx": read_docx}.get(ext)
    if ext not in SUPPORTED:
        raise ValueError("Unsupported file type. Use PDF, PPTX, DOCX, TXT, MD, CSV or a picture (PNG/JPG).")
    try:
        units = (reader or read_text)(data, describe)
    except (zipfile.BadZipFile, KeyError):
        raise ValueError("This file looks damaged or is not a real " + ext.upper().strip(".") + " file.")
    if not units:
        raise ValueError("No readable text found. If this is a scanned file, upload it as pictures with a vision model.")
    return units
