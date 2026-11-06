#!/usr/bin/env python3
"""Generate README image assets for dsh-settlement-docs (docs/assets/).

Outputs (idempotent overwrite):
  dsh-settlement-docs-flow-light.svg / dsh-settlement-docs-flow-dark.svg
      Hero pipeline diagram. Two hand-written SVG files (vector — never
      rasterized to webp). Text inside is command-surface tokens only
      (settlement.check, settlement.export, missing / copies_short / ...,
      $DSH_HOME paths), so all five README languages share the same pair.
      No CJK text is drawn, so the CJK font probe below is a guard for the
      optional evidence chart rather than a requirement of the hero itself.

Existing assets (docs/assets/quickstart.png, docs/assets/quickstart.log) are
real captured output and are kept untouched.

There is no benchmark/RESULTS.md in this repo, so the evidence bar chart
(`…-evidence-{zh,en}-{light,dark}.webp`, Pillow, WEBP quality=90) is not
emitted. The rule is: draw only data that actually exists.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow (pip install pillow)
"""
from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

# --- palette: PerryLink family (accent) + GitHub page backgrounds ----------
FAMILY = "#4B67B4"   # family accent (badges labelColor family uses #2B3245)
GREEN = {"light": "#16a34a", "dark": "#3fb950"}
SKIN = {
    "light": dict(bg="#ffffff", box="#f6f8fa", border="#d0d7de",
                  text="#1f2328", sub="#57606a"),
    "dark": dict(bg="#0d1117", box="#161b22", border="#30363d",
                 text="#f0f6fc", sub="#8b949e"),
}
WEBP_QUALITY = 90

# --- CJK font probe: any future Chinese label must never render as tofu -----
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyh.ttc",      # Microsoft YaHei
    r"C:\Windows\Fonts\simhei.ttf",    # SimHei
    r"C:\Windows\Fonts\Deng.ttf",      # DengXian
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
]
FONT_PATH = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
if FONT_PATH is None:
    sys.exit("FATAL: no CJK font found (looked for msyh.ttc, simhei.ttf, "
             "Deng.ttf, Noto Sans CJK, PingFang). Refusing to render Chinese "
             "as tofu boxes; install one of the probed fonts and re-run.")


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


# ---------------------------------------------------------------------------
# Hero pipeline SVG (light + dark). Tokens only: CSV names, tool names,
# issue types, env paths — no natural-language sentences, so the same pair of
# files serves all five README languages.
# ---------------------------------------------------------------------------
FLOW_NODES = [
    ("checklist.csv", "submitted.csv · UTF-8"),
    ("settlement.check", "missing · copies_short"),
    ("rate_pct + items[]", "8/12 required · 9/14 all"),
    ("settlement.export", "worksheet · UTF-8 BOM"),
    ("exports/*.csv", "$DSH_HOME/…/exports"),
]


def flow_svg(skin: str) -> str:
    s = SKIN[skin]
    w, h = 1200, 400
    nw, nh, gap = 200, 96, 30
    y0 = 150
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}" role="img" '
        f'aria-label="dsh-settlement-docs pipeline">',
        f'<title>dsh-settlement-docs pipeline</title>',
        f'<rect width="{w}" height="{h}" rx="18" fill="{s["bg"]}"/>',
        f'<text x="40" y="62" fill="{s["text"]}" font-family="ui-sans-serif,'
        f'system-ui,sans-serif" font-size="30" font-weight="700">'
        f'dsh-settlement-docs</text>',
        f'<text x="40" y="94" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="16">settlement.check → settlement.export · '
        f'CSV in, CSV out · local only</text>',
        f'<line x1="40" y1="116" x2="1160" y2="116" stroke="{s["border"]}"/>',
    ]
    for i, (label, sub) in enumerate(FLOW_NODES):
        x = 40 + i * (nw + gap)
        accent = GREEN[skin] if i == len(FLOW_NODES) - 1 else (
            FAMILY if 1 <= i <= 3 else s["border"])
        parts.append(
            f'<rect x="{x}" y="{y0}" width="{nw}" height="{nh}" rx="14" '
            f'fill="{s["box"]}" stroke="{accent}" stroke-width="2"/>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 40}" fill="{s["text"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="15" font-weight="700">{label}</text>')
        parts.append(
            f'<text x="{x + nw // 2}" y="{y0 + 68}" fill="{s["sub"]}" '
            f'text-anchor="middle" font-family="ui-monospace,monospace" '
            f'font-size="10">{sub}</text>')
        if i < len(FLOW_NODES) - 1:
            ax = x + nw + 4
            ay = y0 + nh // 2
            parts.append(
                f'<path d="M{ax} {ay}h{gap - 12}" stroke="{s["sub"]}" '
                f'stroke-width="3"/>')
            parts.append(
                f'<path d="M{ax + gap - 14} {ay - 7}l10 7-10 7" fill="none" '
                f'stroke="{s["sub"]}" stroke-width="3" '
                f'stroke-linecap="round" stroke-linejoin="round"/>')
    # dashed connectors into the risk / locality strip
    for cx in (40 + (nw + gap) + nw // 2, 40 + 3 * (nw + gap) + nw // 2):
        parts.append(
            f'<path d="M{cx} {y0 + nh}v{290 - y0 - nh}" '
            f'stroke="{FAMILY}" stroke-width="2" stroke-dasharray="5 5"/>')
    parts.append(
        f'<rect x="40" y="290" width="1120" height="52" rx="12" '
        f'fill="{s["box"]}" stroke="{FAMILY}" stroke-width="2"/>')
    parts.append(
        f'<text x="600" y="322" fill="{s["text"]}" text-anchor="middle" '
        f'font-family="ui-monospace,monospace" font-size="14">'
        f'R0 read-only: settlement.template · settlement.check ｜ R1 local '
        f'write: settlement.export ｜ no network · no model call</text>')
    parts.append(
        f'<text x="40" y="378" fill="{s["sub"]}" font-family="ui-monospace,'
        f'monospace" font-size="13">missing · copies_short · unsigned · '
        f'unstamped (blocking) · optional_missing (info) · worksheet 15 rows '
        f'· sha256</text>')
    parts.append('</svg>')
    return "\n".join(parts) + "\n"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        with open(os.path.join(OUT,
                               f"dsh-settlement-docs-flow-{skin}.svg"),
                  "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(skin))
    print("wrote 2 SVG assets to docs/assets/")


if __name__ == "__main__":
    main()
