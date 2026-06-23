#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path

import pdfplumber

EXPECTED_COLUMNS = [
    "id",
    "name",
    "specialty",
    "city",
    "isClaimed",
    "neighborhood",
    "phone",
    "bio",
    "instagram",
    "linkedin",
    "photoUrl",
    "attendance",
    "ownerUserId",
    "secondarySpecialty",
    "tertiarySpecialty",
    "createdAt",
    "updatedAt",
]

HEADER_ALIASES = {
    "id": "id",
    "name": "name",
    "specialty": "specialty",
    "city": "city",
    "isclaimed": "isClaimed",
    "neighborhood": "neighborhood",
    "phone": "phone",
    "bio": "bio",
    "instagram": "instagram",
    "linkedin": "linkedin",
    "photourl": "photoUrl",
    "attendance": "attendance",
    "owneruserid": "ownerUserId",
    "createdat": "createdAt",
    "updatedat": "updatedAt",
}


def normalize_key(value: str) -> str:
    return "".join(ch for ch in (value or "").strip().lower() if ch.isalnum())


def collapse_spaces(value: str) -> str:
    return " ".join(str(value or "").replace("\u00a0", " ").split())


def find_header_positions(page):
    words = sorted(
        page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False),
        key=lambda item: (round(item["top"], 1), item["x0"]),
    )

    header_words = [word for word in words if word["top"] <= 62]
    starts = {}
    for word in header_words:
        normalized = normalize_key(word["text"])
        alias = HEADER_ALIASES.get(normalized)
        if alias:
            starts.setdefault(alias, word["x0"])

    ordered_known = [starts[column] for column in EXPECTED_COLUMNS if column in starts]
    if len(ordered_known) < 10:
        raise RuntimeError("Could not detect enough header columns in the PDF.")

    diffs = [
        ordered_known[index + 1] - ordered_known[index]
        for index in range(len(ordered_known) - 1)
        if ordered_known[index + 1] - ordered_known[index] > 5
    ]
    default_step = statistics_median(diffs) if diffs else 40.68

    if "secondarySpecialty" not in starts:
        starts["secondarySpecialty"] = starts.get("ownerUserId", ordered_known[-1]) + default_step
    if "tertiarySpecialty" not in starts:
        starts["tertiarySpecialty"] = starts["secondarySpecialty"] + default_step
    if "createdAt" not in starts:
        starts["createdAt"] = starts["tertiarySpecialty"] + default_step
    if "updatedAt" not in starts:
        starts["updatedAt"] = starts["createdAt"] + default_step

    return [starts[column] for column in EXPECTED_COLUMNS]


def statistics_median(values):
    ordered = sorted(values)
    midpoint = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[midpoint]
    return (ordered[midpoint - 1] + ordered[midpoint]) / 2


def build_bounds(starts):
    bounds = []
    for index, start in enumerate(starts):
        left = -math.inf if index == 0 else (starts[index - 1] + start) / 2
        right = math.inf if index == len(starts) - 1 else (start + starts[index + 1]) / 2
        bounds.append((left, right))
    return bounds


def join_words(words):
    if not words:
        return ""
    words = sorted(words, key=lambda item: item["x0"])
    parts = []
    previous = None
    for word in words:
        if previous is not None and word["x0"] - previous["x1"] > 1.5:
            parts.append(" ")
        parts.append(word["text"])
        previous = word
    return collapse_spaces("".join(parts))


def extract_rows(page, bounds):
    words = [
        word
        for word in page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
        if word["top"] > 62
    ]
    lines = []

    for word in sorted(words, key=lambda item: (round(item["top"], 1), item["x0"])):
        assigned = False
        for line in lines:
            if abs(line["top"] - word["top"]) <= 2.5:
                line["words"].append(word)
                line["top"] = min(line["top"], word["top"])
                assigned = True
                break
        if not assigned:
            lines.append({"top": word["top"], "words": [word]})

    extracted_rows = []
    for line in lines:
        row_words = sorted(line["words"], key=lambda item: item["x0"])
        if not row_words:
            continue

        raw_cells = {column: [] for column in EXPECTED_COLUMNS}
        for word in row_words:
            x0 = word["x0"]
            for index, (left, right) in enumerate(bounds):
                if left <= x0 < right:
                    raw_cells[EXPECTED_COLUMNS[index]].append(word)
                    break

        cell_text = {column: join_words(raw_cells[column]) for column in EXPECTED_COLUMNS}
        full_text = join_words(row_words)
        if not full_text:
            continue

        extracted_rows.append(
            {
                "top": round(line["top"], 2),
                "fullText": full_text,
                "rawCells": cell_text,
            }
        )

    return extracted_rows


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: extract-profile-rows.py <pdf-path>")

    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    payload = {
        "pdfPath": str(pdf_path),
        "pages": 0,
        "columns": EXPECTED_COLUMNS,
        "rows": [],
    }

    with pdfplumber.open(str(pdf_path)) as pdf:
        payload["pages"] = len(pdf.pages)
        for page_index, page in enumerate(pdf.pages, start=1):
            starts = find_header_positions(page)
            bounds = build_bounds(starts)
            for row in extract_rows(page, bounds):
                payload["rows"].append(
                    {
                        "page": page_index,
                        **row,
                    }
                )

    json.dump(payload, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
