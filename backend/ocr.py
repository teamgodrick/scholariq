"""Offline text recognition for attendance reports."""
import asyncio
import io
import sys
import threading

_ENGINE = None
_ENGINE_LOCK = threading.Lock()
_RUN_LOCK = threading.Lock()


def _engine():
    global _ENGINE
    with _ENGINE_LOCK:
        if _ENGINE is None:
            try:
                from rapidocr import RapidOCR
                _ENGINE = RapidOCR()
            except ImportError as exc:
                version = f"{sys.version_info.major}.{sys.version_info.minor}"
                raise RuntimeError(
                    f"Offline OCR is unavailable with Python {version}: its runtime dependency is missing "
                    "or has no compatible wheel. The rest of ScholarIQ can still run; use a Python version "
                    "supported by ONNX Runtime to enable report OCR.") from exc
    return _ENGINE


def _windows_ocr_lines(data):
    try:
        from winrt.windows.graphics.imaging import BitmapDecoder
        from winrt.windows.media.ocr import OcrEngine
        from winrt.windows.storage.streams import DataWriter, InMemoryRandomAccessStream
    except ImportError as exc:
        raise RuntimeError(
            "Windows offline OCR is not installed. Restart ScholarIQ to install its OCR dependencies.") from exc

    async def recognize():
        stream = InMemoryRandomAccessStream()
        writer = DataWriter(stream)
        writer.write_bytes(data)
        await writer.store_async()
        writer.detach_stream()
        stream.seek(0)
        decoder = await BitmapDecoder.create_async(stream)
        if decoder.pixel_width * decoder.pixel_height > 30000000:
            raise ValueError("This image is too large to process. Resize it and try again.")
        engine = OcrEngine.try_create_from_user_profile_languages()
        if engine is None:
            raise RuntimeError("Windows has no OCR language installed for your account.")
        bitmap = await decoder.get_software_bitmap_async()
        result = await engine.recognize_async(bitmap)
        return [line.text.strip() for line in result.lines if line.text and line.text.strip()]

    return asyncio.run(recognize())


def read_image_lines(data):
    if sys.platform == "win32" and sys.version_info >= (3, 15):
        with _RUN_LOCK:
            lines = _windows_ocr_lines(data)
        if not lines:
            raise ValueError("No readable text found. Upload a clearer or higher-resolution image.")
        return lines

    try:
        import numpy as np
        from PIL import Image, UnidentifiedImageError
    except ImportError as exc:
        raise RuntimeError(
            "Attendance OCR dependencies are unavailable. The rest of ScholarIQ can still run; "
            "check the launcher's OCR setup warning.") from exc

    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.width * source.height > 30000000:
                raise ValueError("This image is too large to process. Resize it and try again.")
            image = np.asarray(source.convert("RGB"))
    except (UnidentifiedImageError, OSError):
        raise ValueError("The image could not be decoded. Upload a clear PNG, JPG, or WEBP image.")

    with _RUN_LOCK:
        result = _engine()(image)
    if not result or not result.txts:
        raise ValueError("No readable text found. Upload a clearer or higher-resolution image.")
    if result.boxes is None or len(result.boxes) == 0 or len(result.boxes) != len(result.txts):
        return [text.strip() for text in result.txts if text and text.strip()]

    items = []
    for box, text in zip(result.boxes, result.txts):
        text = (text or "").strip()
        if not text:
            continue
        ys = [point[1] for point in box]
        xs = [point[0] for point in box]
        items.append(((min(ys) + max(ys)) / 2, min(xs), max(1, max(ys) - min(ys)), text))
    items.sort(key=lambda item: (item[0], item[1]))
    groups = []
    for center, left, height, text in items:
        if groups and abs(center - groups[-1]["center"]) <= max(6, min(height, groups[-1]["height"]) * 0.6):
            group = groups[-1]
            group["parts"].append((left, text))
            group["center"] = (group["center"] * group["count"] + center) / (group["count"] + 1)
            group["count"] += 1
            group["height"] = max(group["height"], height)
        else:
            groups.append({"center": center, "height": height, "count": 1, "parts": [(left, text)]})
    return [" ".join(text for _, text in sorted(group["parts"])) for group in groups]
