#!/usr/bin/env python3
"""Embed a tiny subset of Nunito into every SVG in public/assets that has text.

SVGs shown with <img> cannot use the page's fonts, so without this their labels
fall back to Arial (Windows) or Helvetica (Mac), change width and can overlap.
Each SVG gets only the glyphs it uses (a few KB), so it looks the same everywhere.

Usage: python3 scripts/embed-svg-fonts.py [assets dir] [Nunito ttf]
Needs: pip install fonttools brotli
"""
import base64
import html
import io
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ASSETS = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets")
FONT = Path(sys.argv[2] if len(sys.argv) > 2 else "src/styles/fonts/Nunito-Variable.ttf")
MARK = "<!--nunito-embedded-->"


def subset_font(chars: str) -> str:
    font = TTFont(str(FONT))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga"]
    opts.name_IDs = []
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=chars)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    return base64.b64encode(buf.getvalue()).decode()


def main() -> None:
    done = skipped = total_bytes = 0
    for svg in sorted(ASSETS.rglob("*.svg")):
        text = svg.read_text(encoding="utf-8")
        if MARK in text or "<text" not in text:
            skipped += 1
            continue
        chunks = re.findall(r"<text[^>]*>(.*?)</text>", text, flags=re.S)
        chars = "".join(html.unescape(re.sub(r"<[^>]+>", "", c)) for c in chunks)
        chars = "".join(sorted(set(chars + chars.upper() + chars.lower() + " 0123456789")))
        data = subset_font(chars)
        style = (
            f"{MARK}<style>@font-face{{font-family:'Nunito';font-weight:200 1000;"
            f"src:url(data:font/woff2;base64,{data}) format('woff2');}}</style>"
        )
        text = re.sub(r"(<svg\b[^>]*>)", lambda m: m.group(1) + style, text, count=1)
        svg.write_text(text, encoding="utf-8")
        done += 1
        total_bytes += len(data)
    print(f"Embedded Nunito in {done} SVGs (+{total_bytes // 1024} KB), skipped {skipped}.")


if __name__ == "__main__":
    main()
