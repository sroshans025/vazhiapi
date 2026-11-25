"""
Export the public Tamil Nadu knowledge base to the frontend bundle.
The site uses it to render landing / schemes / rights / tools without a backend round-trip
(and keeps working when the API is unreachable).

Run after editing tn_context/*.json:   python -m training.export_kb
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from tn_context import knowledge  # noqa: E402
from nlp.crisis_detector import CRISIS_PHRASES, HIGH_PHRASES, SEVERE_PHRASES  # noqa: E402
from nlp.preprocessor import TANGLISH_MARKERS, URGENCY_KEYWORDS  # noqa: E402

OUT = ROOT.parent / "frontend" / "lib" / "kb.json"


def main():
    data = {
        "categories": knowledge.categories(),
        "schemes": knowledge.schemes(),
        "laws": knowledge.laws(),
        "helplines": knowledge.helplines(),
        "districts": knowledge.TN_DISTRICTS,
        "nlp": {
            "crisis": CRISIS_PHRASES, "severe": SEVERE_PHRASES, "high": HIGH_PHRASES,
            "urgency": URGENCY_KEYWORDS, "tanglish": sorted(TANGLISH_MARKERS),
        },
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
