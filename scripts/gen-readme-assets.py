#!/usr/bin/env python3
"""Generate README visuals for dsh-settlement-docs (docs/assets/).

Outputs (idempotent overwrite):
  dsh-settlement-docs-hero-{zh,en}-{light,dark}.webp   1440x576 (Pillow)
  dsh-settlement-docs-flow-v5-{light,dark}.svg         1100x660 (hand-written)

Design notes
------------
Hero -- left column is prose (kicker / two-line wordmark / two value lines /
  one subtitle / one meta / footer). The right column is this plugin's own
  semantic graphic: the completeness check sheet produced by settlement_check.
  It lists all 14 housing-checklist lines from the quickstart fixture, one row
  per line, with required/submitted copies, signature/stamp markers and the
  verdict the checker actually returns:
    * JS-01 copies_short (3 required / 1 submitted), JS-08 + JS-12 missing,
      JS-10 unstamped, JS-14 optional_missing;
    * 9 complete overall, 8 of 12 required; rate 66.67%, overall 64.29%;
    * 4 blocking + 1 info issues.
  The card footer is the settlement_export receipt (15 worksheet rows,
  1,638 bytes, UTF-8 BOM, sha256 prefix). Every number comes from
  samples/quickstart/expected/result.json; nothing is invented.

Flow -- not a row of five boxes. Grammar: two source cards join on the
  document code, then a per-line short-circuit adjudication ladder (submitted?
  copies? signed? stamped?) with side doors for missing / optional_missing /
  copies_short / unsigned / unstamped, a completeness scoreboard with a
  14-cell line strip, and one settlement_export rail. Text is token-only
  (real CSV headers, tool names, issue types, field names, amounts), so one
  light/dark pair serves all five README languages.

Run once:  python scripts/gen-readme-assets.py
Requires:  Python 3.10+ with Pillow; Windows fonts msyh.ttc / msyhbd.ttc /
           consola.ttf / consolab.ttf.
"""
from __future__ import annotations

import os
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

FONT_FILE = {
    "cjk": r"C:\Windows\Fonts\msyh.ttc",
    "cjk_bold": r"C:\Windows\Fonts\msyhbd.ttc",
    "mono": r"C:\Windows\Fonts\consola.ttf",
    "mono_bold": r"C:\Windows\Fonts\consolab.ttf",
}
for _kind, _path in FONT_FILE.items():
    if not os.path.exists(_path):
        raise SystemExit(f"FATAL: font missing: {_path}")

_font_cache: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(size: float, kind: str = "cjk") -> ImageFont.FreeTypeFont:
    key = (kind, max(8, int(round(size))))
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONT_FILE[kind], key[1], index=0)
    return _font_cache[key]


_measure = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def hx(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def text_w(text: str, size: float, kind: str = "cjk") -> float:
    return _measure.textlength(text, font(size, kind))


def fit(text: str, kind: str, limit: float, start: float, floor: float) -> float:
    size = float(start)
    while size > floor and text_w(text, size, kind) > limit:
        size -= 0.5
    if text_w(text, size, kind) > limit:
        raise SystemExit(
            f"FATAL: cannot fit {text!r} into {limit:.0f}px "
            f"(floor {floor}px, needs {text_w(text, size, kind):.0f}px)")
    return size


def put(d: ImageDraw.ImageDraw, xy: tuple[float, float], text: str,
        size: float, kind: str, color: str, *, limit: float | None = None,
        anchor: str = "ls", tag: str = "") -> float:
    width = text_w(text, size, kind)
    if limit is not None and width > limit:
        raise SystemExit(
            f"FATAL: overflow in {tag or 'text'}: {text!r} is "
            f"{width:.0f}px > {limit:.0f}px at {size}px")
    d.text(xy, text, font=font(size, kind), fill=hx(color), anchor=anchor)
    return width


# ---------------------------------------------------------------- primitives
SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8", card="#ffffff",
        card_edge="#e4e1ee", zone="#f5f2fb", zone_edge="#e3def1",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", warn="#c2410c", bad="#b42318", good="#16a34a",
        pill="#ece7f9", track="#eae6f3", grid="#e7e4f0",
        warn_bg="#fdf3e6", bad_bg="#fbeceb", faint_bg="#f3f2f7",
        shadow=(32, 26, 64),
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016", card="#1b2231",
        card_edge="#2e374b", zone="#171e2d", zone_edge="#2b3448",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", warn="#d9a03c", bad="#f97066", good="#3fb950",
        pill="#242d42", track="#243049", grid="#1e2636",
        warn_bg="#382e1e", bad_bg="#3a2227", faint_bg="#232a39",
        shadow=(0, 0, 0),
    ),
}


def gradient(w: int, h: int, c1: str, c2: str) -> Image.Image:
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    a, b = hx(c1), hx(c2)
    for y in range(h):
        t = 0.25 * (y / h) + 0.75 * (y / h) ** 1.6
        d.line([(0, y), (w, y)],
               fill=tuple(int(p + (q - p) * t) for p, q in zip(a, b)))
    return img


def glow(img: Image.Image, cx: float, cy: float, r: float, color: str,
         alpha: int = 30) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(10, 0, -1):
        rr = r * i / 10
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=hx(color) + (int(alpha * (1 - i / 11)),))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def card(img: Image.Image, box: tuple[int, int, int, int], skin: dict,
         radius: int = 22, shadow: int = 26) -> Image.Image:
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -3):
        sd.rounded_rectangle([x0 - i // 5, y0 + i // 2, x1 + i // 5, y1 + i],
                             radius=radius + i // 5,
                             fill=skin["shadow"] + (int(7 * (1 - i / shadow)),))
    base = Image.alpha_composite(img.convert("RGBA"),
                                 sh.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(skin["card"]),
                        outline=hx(skin["card_edge"]), width=2)
    return base.convert("RGB")


def pill(img: Image.Image, box: tuple[int, int, int, int], text: str,
         size: float, kind: str, fg: str, bg: str,
         anchor_center: tuple[float, float] | None = None) -> Image.Image:
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=hx(bg))
    if anchor_center is not None:
        d.text(anchor_center, text, font=font(size, kind), fill=hx(fg),
               anchor="mm")
    return img


# --------------------------------------------------------------- hero model
# Rows: code, required/submitted copies, signature/stamp, verdict, tone,
# optional flag. All values are the quickstart fixture's real check result.
HERO_ROWS = [
    ("JS-01", "3/1", "是/是", "Y/Y", "copies_short", "warn", False),
    ("JS-02", "2/2", "是/是", "Y/Y", "complete", "good", False),
    ("JS-03", "1/1", "是/是", "Y/Y", "complete", "good", False),
    ("JS-04", "1/1", "是/是", "Y/Y", "complete", "good", False),
    ("JS-05", "1/1", "是/是", "Y/Y", "complete", "good", False),
    ("JS-06", "1/1", "是/是", "Y/Y", "complete", "good", False),
    ("JS-07", "1/1", "是/是", "Y/Y", "complete", "good", False),
    ("JS-08", "2/0", "—/—", "—/—", "missing", "bad", False),
    ("JS-09", "2/2", "是/是", "Y/Y", "complete", "good", False),
    ("JS-10", "1/1", "是/否", "Y/N", "unstamped", "bad", False),
    ("JS-11", "1/1", "是/是", "Y/Y", "complete", "good", False),
    ("JS-12", "1/0", "—/—", "—/—", "missing", "bad", False),
    ("JS-13", "1/1", "是/是", "Y/Y", "complete", "good", True),
    ("JS-14", "1/0", "—/—", "—/—", "optional_missing", "faint", True),
]

HERO = {
    "zh": dict(
        kicker="DeepSeek Harness · 竣工结算资料核对",
        title=("dsh-settlement-", "docs"),
        value=("按资料清单逐行核对实际提交：",
               "缺件、份数、签字、盖章一次说清"),
        sub="清单 CSV + 提交 CSV → 齐套率 → 核对表",
        meta="R0 只读 / R1 本地写 · 不联网 · 不调模型 · 不上传",
        foot="Apache-2.0 · PerryLink DSH plugin family · dsh ≥0.2.1 <0.4.0",
        sheet_label="settlement_check · R0",
        sheet_sub="房建 · 14 items · 12 required",
        rate="66.67%",
        rate_note="齐套率 · 8/12 必需",
        th_code="编码",
        th_copies="应/实",
        th_sign="签/章",
        th_verdict="判定",
        sum_counts="missing 2 · copies_short 1 · unsigned 0 · unstamped 1 · optional_missing 1",
        sum_line="blocking 4 · info 1 · overall 64.29% · 9/14",
        exp_line="settlement_export · R1 → 15-row worksheet · 1,638 B · UTF-8 BOM · sha256 6a09d934…",
    ),
    "en": dict(
        kicker="DeepSeek Harness · settlement document check",
        title=("dsh-settlement-", "docs"),
        value=("Checklist vs submission, line by line:",
               "gaps, copies, signature, stamp, rate"),
        sub="checklist CSV + submission CSV → rate → worksheet",
        meta="R0 read-only / R1 local write · offline · no model call",
        foot="Apache-2.0 · PerryLink DSH plugin family · dsh ≥0.2.1 <0.4.0",
        sheet_label="settlement_check · R0",
        sheet_sub="housing · 14 items · 12 required",
        rate="66.67%",
        rate_note="rate · 8/12 required",
        th_code="code",
        th_copies="req/sub",
        th_sign="sign/stamp",
        th_verdict="verdict",
        sum_counts="missing 2 · copies_short 1 · unsigned 0 · unstamped 1 · optional_missing 1",
        sum_line="blocking 4 · info 1 · overall 64.29% · 9/14",
        exp_line="settlement_export · R1 → 15-row worksheet · 1,638 B · UTF-8 BOM · sha256 6a09d934…",
    ),
}

TONE_COLOR = {"good": "good", "warn": "warn", "bad": "bad", "faint": "faint"}


def hero(lang: str, skin_name: str) -> None:
    s = SKIN[skin_name]
    h = HERO[lang]
    it = iter(HERO_ROWS)
    zh = lang == "zh"
    w, hgt = 1440, 576
    img = gradient(w, hgt, s["bg_from"], s["bg_to"])
    img = glow(img, 1200, 40, 430, s["accent"],
               22 if skin_name == "light" else 42)
    img = glow(img, 90, 560, 300, s["accent"],
               9 if skin_name == "light" else 15)
    d = ImageDraw.Draw(img)

    # ------------------------------------------------------- left column
    m, col = 54, 700
    ksize = 19
    kw = text_w(h["kicker"], ksize, "cjk_bold")
    if kw > col - 74:
        raise SystemExit(f"FATAL: hero kicker too wide: {kw:.0f}px")
    img = pill(img, (m, 50, m + kw + 74, 92), h["kicker"], ksize,
               "cjk_bold", s["accent"], s["pill"], None)
    d = ImageDraw.Draw(img)
    d.ellipse([m + 24, 67, m + 32, 75], fill=hx(s["accent"]))
    put(d, (m + 46, 71), h["kicker"], ksize, "cjk_bold", s["accent"],
        limit=col - 74, anchor="lm", tag="hero.kicker")

    tsize = 80
    put(d, (m, 190), h["title"][0], tsize, "mono_bold", s["text"],
        limit=col, tag="hero.title1")
    put(d, (m, 278), h["title"][1], tsize, "mono_bold", s["text"],
        limit=col, tag="hero.title2")

    vkind = "cjk_bold"
    vsize = 32
    for i, line in enumerate(h["value"]):
        put(d, (m, 346 + i * 44), line, vsize, vkind, s["text"], limit=col,
            tag=f"hero.value{i}")

    put(d, (m, 462), h["sub"], 25, "cjk", s["sub"], limit=col,
        tag="hero.sub")
    put(d, (m, 502), h["meta"], 20, "cjk", s["faint"], limit=col,
        tag="hero.meta")
    d.line([m, 518, m + 620, 518], fill=hx(s["grid"]), width=2)
    put(d, (m, 548), h["foot"], 15.5, "cjk", s["faint"], limit=col,
        tag="hero.foot")

    # ---------------------------------------------- completeness check sheet
    x0, y0, x1, y1 = 772, 40, 1384, 532
    img = card(img, (x0, y0, x1, y1), s)
    d = ImageDraw.Draw(img)
    lx, rx = x0 + 24, x1 - 24

    put(d, (lx, 72), h["sheet_label"], 14, "mono", s["accent"], limit=300,
        tag="hero.sheet_label")
    put(d, (lx, 94), h["sheet_sub"], 13, "cjk", s["sub"], limit=320,
        tag="hero.sheet_sub")
    put(d, (rx, 94), h["rate"], 36, "mono_bold", s["accent"], anchor="rs",
        limit=220, tag="hero.rate")
    put(d, (rx, 112), h["rate_note"], 11.5, "cjk", s["faint"], anchor="rs",
        limit=220, tag="hero.rate_note")
    d.line([lx, 122, rx, 122], fill=hx(s["grid"]), width=2)

    # table header
    put(d, (lx, 144), h["th_code"], 12, "cjk", s["faint"], limit=70,
        tag="hero.th_code")
    put(d, (960, 144), h["th_copies"], 12, "cjk", s["faint"], anchor="rs",
        limit=90, tag="hero.th_copies")
    put(d, (1010, 144), h["th_sign"], 12, "cjk", s["faint"], limit=110,
        tag="hero.th_sign")
    put(d, (rx, 144), h["th_verdict"], 12, "cjk", s["faint"], anchor="rs",
        limit=100, tag="hero.th_verdict")

    row_y = 164
    pitch = 20.3
    for i, (code, copies, sign_zh, sign_en, verdict, tone, optional) in \
            enumerate(it):
        y = row_y + i * pitch
        tone_color = s[TONE_COLOR[tone]]
        if tone == "bad":
            d.rounded_rectangle([lx - 8, y - 15, rx + 6, y + 5], radius=7,
                                fill=hx(s["bad_bg"]))
        elif tone == "warn":
            d.rounded_rectangle([lx - 8, y - 15, rx + 6, y + 5], radius=7,
                                fill=hx(s["warn_bg"]))
        elif tone == "faint":
            d.rounded_rectangle([lx - 8, y - 15, rx + 6, y + 5], radius=7,
                                fill=hx(s["faint_bg"]))
        code_color = s["faint"] if optional else s["text"]
        put(d, (lx, y), code, 14, "mono_bold", code_color, limit=76,
            tag=f"hero.code{i}")
        put(d, (960, y), copies, 14, "mono", s["sub"], anchor="rs",
            limit=80, tag=f"hero.copies{i}")
        put(d, (1010, y), sign_zh if zh else sign_en, 14,
            "cjk" if zh else "mono", s["sub"], limit=100,
            tag=f"hero.sign{i}")
        put(d, (rx, y), verdict, 12.5, "mono_bold",
            s["sub"] if tone == "good" else tone_color, anchor="rs",
            limit=210, tag=f"hero.verdict{i}")

    d.line([lx, 444, rx, 444], fill=hx(s["grid"]), width=2)
    put(d, (lx, 468), h["sum_counts"], 12, "mono", s["sub"], limit=566,
        tag="hero.sum_counts")
    put(d, (lx, 491), h["sum_line"], 13, "mono_bold", s["text"], limit=566,
        tag="hero.sum_line")
    put(d, (lx, 514), h["exp_line"], 11.2, "mono", s["faint"], limit=566,
        tag="hero.exp_line")

    path = os.path.join(OUT, f"dsh-settlement-docs-hero-{lang}-"
                             f"{skin_name}.webp")
    img.save(path, "WEBP", quality=92)
    print(f"wrote {os.path.basename(path)}")


# ------------------------------------------------------------- flow diagram
FLOW = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8", card="#ffffff",
        edge="#e4e1ee", zone="#f5f2fb", zone_edge="#e3def1",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", warn="#b0470f", bad="#b42318", good="#15803d",
        pill="#ece7f9", track="#eae6f3", grid="#e7e4f0", dot="#d9d3ea",
        shadow="#1b1735", shadow_op="0.10",
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016", card="#1b2231",
        edge="#2e374b", zone="#171e2d", zone_edge="#2b3448",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", warn="#d9a03c", bad="#f97066", good="#3fb950",
        pill="#242d42", track="#243049", grid="#1e2636", dot="#26314a",
        shadow="#000000", shadow_op="0.55",
    ),
}

MONO = "Consolas,'Microsoft YaHei',ui-monospace,monospace"
SANS = "'Microsoft YaHei','Segoe UI',sans-serif"

# The quickstart check result, one entry per checklist line, in checklist order.
LINE_STATES = [
    ("JS-01", "short"), ("JS-02", "done"), ("JS-03", "done"),
    ("JS-04", "done"), ("JS-05", "done"), ("JS-06", "done"),
    ("JS-07", "done"), ("JS-08", "missing"), ("JS-09", "done"),
    ("JS-10", "unstamped"), ("JS-11", "done"), ("JS-12", "missing"),
    ("JS-13", "opt_done"), ("JS-14", "opt_missing"),
]


def svg_w(text: str, size: float, mono: bool = True) -> float:
    """Conservative width: ASCII with the real font, every other char as 1.02em."""
    ascii_part = "".join(ch if ord(ch) < 128 else "" for ch in text)
    wide = len(text) - len(ascii_part)
    kind = "mono" if mono else "cjk"
    return text_w(ascii_part, size, kind) + wide * size * 1.02


def svg_text(x: float, y: float, text: str, size: float, fill: str, *,
             mono: bool = True, bold: bool = False,
             anchor: str | None = None, opacity: float | None = None,
             limit: float | None = None, tag: str = "") -> str:
    if limit is not None and svg_w(text, size, mono) > limit:
        raise SystemExit(
            f"FATAL: svg overflow in {tag or 'text'}: {text!r} is "
            f"{svg_w(text, size, mono):.0f}px > {limit:.0f}px at {size}px")
    attrs = [
        f'x="{x:g}"', f'y="{y:g}"', f'fill="{fill}"',
        f'font-family="{MONO if mono else SANS}"', f'font-size="{size:g}"',
    ]
    if bold:
        attrs.append('font-weight="700"')
    if anchor:
        attrs.append(f'text-anchor="{anchor}"')
    if opacity is not None:
        attrs.append(f'opacity="{opacity:g}"')
    return f'<text {" ".join(attrs)}>{escape(text)}</text>'


def flow_svg(skin_name: str) -> None:
    f = FLOW[skin_name]
    p: list[str] = []

    p.append(f'''<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="660" viewBox="0 0 1100 660" role="img" aria-label="dsh-settlement-docs: a checklist CSV and an actual-submission CSV join on the document code; every checklist line runs a short-circuit adjudication ladder (submitted, copies, signed, stamped) with side doors for missing, optional_missing, copies_short, unsigned and unstamped; a completeness scoreboard reports 66.67% (8/12 required) and 4 blocking plus 1 info issue; settlement_export writes a 15-row UTF-8 BOM worksheet into the DSH_HOME exports directory">
<title>dsh-settlement-docs: two CSVs, a per-line short-circuit ladder, one completeness scoreboard and worksheet</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="{f['bg_from']}"/>
    <stop offset="1" stop-color="{f['bg_to']}"/>
  </linearGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="180%">
    <feDropShadow dx="0" dy="8" stdDeviation="11" flood-color="{f['shadow']}" flood-opacity="{f['shadow_op']}"/>
  </filter>
  <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
    <circle cx="1.4" cy="1.4" r="1.4" fill="{f['dot']}"/>
  </pattern>
</defs>
<rect width="1100" height="660" fill="url(#bg)"/>
<rect width="1100" height="660" fill="url(#dots)" opacity=".4"/>''')

    # header ---------------------------------------------------------------
    p.append(svg_text(44, 62, "dsh-settlement-docs", 31, f["text"],
                      bold=True, limit=460, tag="title"))
    p.append(svg_text(44, 88,
                      "checklist governs · 4 gates per line · CSV in / CSV out · local only",
                      15, f["sub"], mono=False, limit=640, tag="subtitle"))
    p.append(f'<rect x="726" y="38" width="330" height="34" rx="17" fill="{f["pill"]}"/>')
    p.append(svg_text(891, 60, "quickstart · 14 items / 11 submitted", 14,
                      f["accent"], anchor="middle", limit=306, tag="pill"))
    p.append(f'<line x1="44" y1="102" x2="1056" y2="102" stroke="{f["grid"]}" stroke-width="1.5"/>')

    # input cards ----------------------------------------------------------
    p.append(f'<g filter="url(#soft)"><rect x="40" y="112" width="500" height="120" rx="20" fill="{f["card"]}" stroke="{f["edge"]}" stroke-width="1.5"/></g>')
    p.append(svg_text(60, 140, "INPUT A · checklist_csv", 14, f["accent"],
                      bold=True, limit=250, tag="A.label"))
    p.append(svg_text(520, 140, "14 items · 12 required", 14, f["sub"],
                      anchor="end", limit=190, tag="A.badge"))
    p.append(f'<line x1="60" y1="152" x2="520" y2="152" stroke="{f["grid"]}" stroke-width="1.3"/>')
    p.append(svg_text(60, 178, "资料编码 · 资料名称 · 应有份数 · 是否必需", 14,
                      f["sub"], limit=450, tag="A.cols"))
    p.append(svg_text(60, 200, "UTF-8 · unique code · empty → E_SETTLEMENT_EMPTY",
                      14, f["faint"], limit=450, tag="A.note1"))
    p.append(svg_text(60, 222, "EN aliases ok · extra columns ignored",
                      14, f["faint"], limit=306, tag="A.note2"))
    p.append(svg_text(520, 178, "sha256 63b248bd…", 14, f["faint"],
                      anchor="end", limit=150, tag="A.sha"))

    p.append(f'<g filter="url(#soft)"><rect x="560" y="112" width="500" height="120" rx="20" fill="{f["card"]}" stroke="{f["edge"]}" stroke-width="1.5"/></g>')
    p.append(svg_text(580, 140, "INPUT B · submission_csv", 14, f["accent"],
                      bold=True, limit=250, tag="B.label"))
    p.append(svg_text(1040, 140, "11 rows · header-only = 0", 14, f["sub"],
                      anchor="end", limit=210, tag="B.badge"))
    p.append(f'<line x1="580" y1="152" x2="1040" y2="152" stroke="{f["grid"]}" stroke-width="1.3"/>')
    p.append(svg_text(580, 178, "资料编码 · 文件名 · 份数 · 签字 · 盖章", 14,
                      f["sub"], limit=450, tag="B.cols"))
    p.append(svg_text(580, 200, "UTF-8 · blank sign/stamp = no", 14,
                      f["faint"], limit=330, tag="B.note1"))
    p.append(svg_text(1040, 178, "sha256 56ff41dc…", 14, f["faint"],
                      anchor="end", limit=150, tag="B.sha"))
    p.append(svg_text(580, 222, "unknown code → E_SETTLEMENT_UNKNOWN_CODE",
                      14, f["faint"], limit=350, tag="B.note2"))

    # arrows into the code join bar
    for ax in (290, 810):
        p.append(f'<line x1="{ax}" y1="234" x2="{ax}" y2="243" stroke="{f["accent"]}" stroke-width="2" opacity=".55"/>')
        p.append(f'<path d="M{ax - 5} 242 L{ax + 5} 242 L{ax} 249 Z" fill="{f["accent"]}" opacity=".7"/>')

    # code join bar --------------------------------------------------------
    p.append(f'<rect x="40" y="252" width="1020" height="36" rx="18" fill="{f["zone"]}" stroke="{f["accent"]}" stroke-width="1.4" opacity=".98"/>')
    p.append(svg_text(60, 275, "code join · 14 × 11 → 14 lines", 17,
                      f["accent"], bold=True, limit=300, tag="join.name"))
    p.append(svg_text(380, 275, "11 matched · 3 not submitted", 14,
                      f["sub"], limit=300, tag="join.facts"))
    p.append(svg_text(1040, 275, "duplicate → E_SETTLEMENT_DUP_CODE", 14,
                      f["faint"], anchor="end", limit=300, tag="join.err"))
    p.append(f'<line x1="370" y1="290" x2="370" y2="299" stroke="{f["accent"]}" stroke-width="2" opacity=".55"/>')
    p.append(f'<path d="M365 298 L375 298 L370 305 Z" fill="{f["accent"]}" opacity=".7"/>')

    # ------------------------------------------------ per-line ladder card
    p.append(f'<g filter="url(#soft)"><rect x="40" y="308" width="640" height="240" rx="20" fill="{f["card"]}" stroke="{f["edge"]}" stroke-width="1.5"/></g>')
    p.append(svg_text(60, 332, "per line · short-circuit", 17, f["accent"],
                      bold=True, limit=300, tag="ladder.name"))
    p.append(svg_text(660, 332, "repeat ×14", 14, f["faint"], anchor="end",
                      limit=120, tag="ladder.meta"))
    p.append(f'<line x1="60" y1="344" x2="660" y2="344" stroke="{f["grid"]}" stroke-width="1.3"/>')
    p.append(svg_text(60, 358, "start · row i of 14", 13.5, f["faint"],
                      limit=250, tag="ladder.entry"))

    p.append(svg_text(660, 358, "↓ yes · → no", 13.5, f["faint"],
                      anchor="end", limit=200, tag="ladder.legend"))

    decisions = [
        (388, "submitted ?", [("missing", f["bad"]),
                              ("optional_missing", f["faint"])]),
        (428, "copies ≥ required ?", [("copies_short", f["bad"])]),
        (468, "signed ?", [("unsigned", f["bad"])]),
        (508, "stamped ?", [("unstamped", f["bad"])]),
    ]
    for index, (base, condition, chips) in enumerate(decisions):
        # condition pill
        p.append(f'<rect x="60" y="{base - 22}" width="350" height="24" rx="12" fill="{f["zone"]}" stroke="{f["accent"]}" stroke-width="1.3"/>')
        p.append(svg_text(76, base - 5, condition, 17, f["text"],
                          bold=True, limit=315, tag=f"d{index}.cond"))
        # "no" side arrow
        p.append(f'<line x1="410" y1="{base - 10}" x2="438" y2="{base - 10}" stroke="{f["faint"]}" stroke-width="1.8"/>')
        p.append(f'<path d="M437 {base - 14} L444 {base - 10} L437 {base - 6} Z" fill="{f["faint"]}"/>')
        # fail doors
        if len(chips) == 1:
            label, color = chips[0]
            p.append(f'<rect x="446" y="{base - 21}" width="214" height="22" rx="11" fill="{color}" opacity=".12"/>')
            p.append(f'<rect x="446" y="{base - 21}" width="214" height="22" rx="11" fill="none" stroke="{color}" stroke-width="1.1" opacity=".55"/>')
            p.append(svg_text(456, base - 6, label, 14, color, bold=True,
                              limit=196, tag=f"d{index}.chip"))
        else:
            for j, (label, color) in enumerate(chips):
                if j == 0:
                    bx, bw, tx, tl, size = 446, 66, 452, 56, 14
                else:
                    bx, bw, tx, tl, size = 520, 140, 526, 130, 13.75
                p.append(f'<rect x="{bx}" y="{base - 21}" width="{bw}" height="22" rx="11" fill="{color}" opacity=".12"/>')
                p.append(f'<rect x="{bx}" y="{base - 21}" width="{bw}" height="22" rx="11" fill="none" stroke="{color}" stroke-width="1.1" opacity=".55"/>')
                p.append(svg_text(tx, base - 6, label, size, color, bold=True,
                                  limit=tl, tag=f"d{index}.chip{j}"))
        # "yes" down connector (the last pass is labelled by the door itself)
        next_base = decisions[index + 1][0] if index + 1 < len(decisions) else 516
        p.append(f'<line x1="90" y1="{base + 2}" x2="90" y2="{next_base - 2}" stroke="{f["accent"]}" stroke-width="1.8" opacity=".6"/>')
        p.append(f'<path d="M86 {next_base - 8} L90 {next_base - 2} L94 {next_base - 8} Z" fill="{f["accent"]}" opacity=".7"/>')

    # pass door
    p.append(f'<rect x="60" y="516" width="150" height="24" rx="12" fill="{f["good"]}" opacity=".14"/>')
    p.append(f'<rect x="60" y="516" width="150" height="24" rx="12" fill="none" stroke="{f["good"]}" stroke-width="1.3"/>')
    p.append(svg_text(76, 533, "complete", 15, f["good"], bold=True,
                      limit=120, tag="pass.label"))
    p.append(svg_text(224, 533, "4 / 4 · counts toward rate", 13.75, f["faint"],
                      limit=300, tag="pass.note"))

    # ------------------------------------------------ summary scoreboard
    p.append(f'<g filter="url(#soft)"><rect x="700" y="308" width="360" height="240" rx="20" fill="{f["card"]}" stroke="{f["edge"]}" stroke-width="1.5"/></g>')
    p.append(svg_text(720, 332, "summary · R0", 17, f["accent"], bold=True,
                      limit=180, tag="sum.name"))
    p.append(svg_text(1040, 332, "blocking 4 · info 1", 14, f["warn"],
                      bold=True, anchor="end", limit=170, tag="sum.levels"))
    p.append(f'<line x1="720" y1="344" x2="1040" y2="344" stroke="{f["grid"]}" stroke-width="1.3"/>')
    p.append(svg_text(720, 382, "66.67%", 40, f["accent"], bold=True,
                      limit=200, tag="sum.rate"))
    p.append(svg_text(720, 400, "rate · 8 / 12 required", 13.75, f["sub"],
                      limit=240, tag="sum.rate_note"))
    p.append(f'<rect x="720" y="410" width="320" height="10" rx="5" fill="{f["track"]}"/>')
    p.append(f'<rect x="720" y="410" width="{round(320 * 0.6667)}" height="10" rx="5" fill="{f["accent"]}"/>')
    p.append(svg_text(720, 438, "overall 64.29% · 9 / 14", 14, f["sub"],
                      limit=300, tag="sum.overall"))
    p.append(svg_text(720, 462, "14 lines · 9 complete / 8 required", 13.75,
                      f["faint"], limit=300, tag="sum.strip_label"))

    state_color = {
        "done": f["good"], "short": f["warn"], "missing": f["bad"],
        "unstamped": f["warn"], "opt_done": f["accent"],
        "opt_missing": f["faint"],
    }
    for i, (_code, state) in enumerate(LINE_STATES):
        cx = 720 + i * 22
        color = state_color[state]
        opacity = ".45" if state == "opt_done" else "1"
        if state == "opt_missing":
            p.append(f'<rect x="{cx}" y="470" width="16" height="16" rx="4" fill="none" stroke="{color}" stroke-width="1.3" opacity=".8"/>')
        else:
            p.append(f'<rect x="{cx}" y="470" width="16" height="16" rx="4" fill="{color}" opacity="{opacity}"/>')
    p.append(svg_text(720, 508, "complete 9 · missing 2 · short 1",
                      13.75, f["faint"], limit=310, tag="sum.legend1"))
    p.append(svg_text(720, 524, "unstamped 1 · optional 1 · unsigned 0",
                      13.75, f["faint"], limit=310, tag="sum.legend2"))

    # chevron: ladder -> scoreboard
    p.append(f'<path d="M686 394 L696 400 L686 406" fill="none" stroke="{f["accent"]}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>')

    # ------------------------------------------------ export rail
    for ax in (340, 850):
        p.append(f'<line x1="{ax}" y1="548" x2="{ax}" y2="552" stroke="{f["accent"]}" stroke-width="2" opacity=".55"/>')
        p.append(f'<path d="M{ax - 5} 551 L{ax + 5} 551 L{ax} 556 Z" fill="{f["accent"]}" opacity=".7"/>')
    p.append(f'<g filter="url(#soft)"><rect x="40" y="556" width="1020" height="76" rx="18" fill="{f["card"]}" stroke="{f["edge"]}" stroke-width="1.5"/></g>')
    p.append(svg_text(60, 582, "settlement_export · R1", 17, f["accent"],
                      bold=True, limit=220, tag="export.name"))
    p.append(svg_text(300, 582,
                      "worksheet CSV · 15 rows (header + 14) · 1,638 B · UTF-8 BOM",
                      14, f["text"], limit=500, tag="export.facts"))
    p.append(svg_text(1040, 582, "sha256 6a09d934…", 14, f["faint"],
                      anchor="end", limit=150, tag="export.sha"))
    p.append(svg_text(60, 606,
                      "$DSH_HOME/dsh-settlement-docs/exports/settlement-check-2026-11.csv",
                      14, f["sub"], limit=560, tag="export.path"))
    p.append(svg_text(1040, 606, "source CSV read-only", 14, f["faint"],
                      anchor="end", limit=200, tag="export.note"))
    p.append(svg_text(60, 626,
                      "12 columns · one row per checklist line · issue type + message joined",
                      14, f["sub"], limit=850, tag="export.columns"))
    p.append(svg_text(1040, 626, "no model · no upload", 14, f["faint"],
                      anchor="end", limit=180, tag="export.offline"))

    # footer ---------------------------------------------------------------
    p.append(svg_text(44, 650,
                      "complete = submitted + copies ≥ required + signed + stamped · rate = required complete ÷ required × 100 · bad code aborts",
                      14, f["faint"], limit=1010, tag="footer"))
    p.append("</svg>")

    path = os.path.join(OUT, f"dsh-settlement-docs-flow-v5-{skin_name}.svg")
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(p) + "\n")
    print(f"wrote {os.path.basename(path)}")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin_name in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin_name)
        flow_svg(skin_name)


if __name__ == "__main__":
    main()
