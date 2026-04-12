from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from app.modules.ai.repository import GeminiError, GeminiParseError, extract_course_structure

    if len(sys.argv) < 2:
        print("Usage: python scripts/test_gemini_extract.py <pdf_path> [en|ar]")
        return 1

    pdf_path = Path(sys.argv[1])
    language = sys.argv[2] if len(sys.argv) > 2 else "en"

    if language not in {"en", "ar"}:
        print("Language must be 'en' or 'ar'")
        return 1

    if not pdf_path.exists() or not pdf_path.is_file():
        print(f"File not found: {pdf_path}")
        return 1

    try:
        pdf_bytes = pdf_path.read_bytes()
        data = extract_course_structure(pdf_bytes, language)
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0
    except (GeminiError, GeminiParseError) as exc:
        print(f"Gemini extraction failed: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
