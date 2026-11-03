"""Extracts text lines with font metadata from a PDF (one JSON line per text line).

    python3 scripts/pdf_lines.py input.pdf [--tables] > output.jsonl

With --tables, ruled tables are read with pdfplumber's table finder: each row becomes one
record whose text is the cells joined with " | " and which carries "tb": 1; text lines
inside a table are left out.

Each record: {"p": page, "x": x0, "y": top, "s": font size, "b": all-bold, "i": all-italic, "t": text}
The Node build (scripts/lib/pdfdoc.mjs) turns these into sections and paragraphs.
"""
import json
import sys

import pdfplumber


def table_records(page, pn):
    """Ruled tables on the page: one record per row, cells joined with " | " (flag "tb")."""
    out, boxes = [], []
    for table in page.find_tables():
        rows = table.extract()
        if not rows or len(rows[0]) < 2:
            continue
        boxes.append(table.bbox)
        sizes = [round(c["size"], 1) for c in page.within_bbox(table.bbox).chars if c["text"].strip()]
        size = max(set(sizes), key=sizes.count) if sizes else 9.0
        for r, row in zip(table.rows, rows):
            cells = [" ".join((c or "").split()) for c in row]
            if not any(cells):
                continue
            text = " | ".join(c for c in cells if c)
            out.append({"p": pn, "x": round(table.bbox[0], 1), "y": round(r.bbox[1], 1), "s": size, "b": False, "i": False, "tb": 1, "t": text})
    return out, boxes


def inside(line, boxes):
    cy = (line["top"] + line["bottom"]) / 2
    return any(b[0] - 1 <= line["x0"] and line["x1"] <= b[2] + 1 and b[1] - 1 <= cy <= b[3] + 1 for b in boxes)


def main(path, tables=False):
    out = sys.stdout
    with pdfplumber.open(path) as pdf:
        for pn, page in enumerate(pdf.pages, 1):
            recs, boxes = table_records(page, pn) if tables else ([], [])
            for line in page.extract_text_lines(return_chars=True, keep_blank_chars=False):
                if boxes and inside(line, boxes):
                    continue
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
                recs.append(rec)
            for rec in sorted(recs, key=lambda r: r["y"]):
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main(sys.argv[1], tables="--tables" in sys.argv[2:])
