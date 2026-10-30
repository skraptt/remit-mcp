"""Extracts text lines with font metadata from a PDF (one JSON line per text line).

    python3 scripts/pdf_lines.py input.pdf > output.jsonl

Each record: {"p": page, "x": x0, "y": top, "s": font size, "b": all-bold, "i": all-italic, "t": text}
The Node build (scripts/lib/pdfdoc.mjs) turns these into sections and paragraphs.
"""
import json
import sys

import pdfplumber


def main(path):
    out = sys.stdout
    with pdfplumber.open(path) as pdf:
        for pn, page in enumerate(pdf.pages, 1):
            for line in page.extract_text_lines(return_chars=True, keep_blank_chars=False):
                chars = [c for c in line["chars"] if c["text"].strip()]
                if not chars:
                    continue
                # Dominant size: the size of most characters (superscripts are smaller).
                sizes = {}
                for c in chars:
                    s = round(c["size"], 1)
                    sizes[s] = sizes.get(s, 0) + 1
                size = max(sizes.items(), key=lambda kv: kv[1])[0]
                fonts = [c["fontname"].split("+")[-1].lower() for c in chars if round(c["size"], 1) == size]
                # Rebuild the text from characters: spaces from horizontal gaps; footnote
                # reference markers (small superscript digits inside the line) are dropped.
                parts, prev = [], None
                for i, c in enumerate(chars):
                    if i > 0 and c["text"].isdigit() and c["size"] < size * 0.8:
                        continue
                    if prev is not None and c["x0"] - prev["x1"] > 0.18 * min(c["size"], prev["size"]):
                        parts.append(" ")
                    parts.append(c["text"])
                    prev = c
                text = "".join(parts)
                rec = {
                    "p": pn,
                    "x": round(line["x0"], 1),
                    "y": round(line["top"], 1),
                    "s": size,
                    "b": all("bold" in f or "black" in f for f in fonts),
                    "i": all("italic" in f or "oblique" in f for f in fonts),
                    "t": text,
                }
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
