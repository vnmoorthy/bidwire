#!/usr/bin/env python3
"""
Bidwire pitch deck generator ("Ledger Light" brand: docs/DESIGN.md).

    python3 build_deck.py           # builds Bidwire.pptx and index.html
    python3 build_deck.py --pptx    # only the PowerPoint
    python3 build_deck.py --html    # only the browser deck

* PowerPoint: python-pptx for the slides, then lxml injects slide transitions (<p:transition>) and entrance
  animations (<p:timing>: fade / float-up / wipe / stamp), auto-staggered right after each slide appears.
* Browser: index.src.html is the template; fonts and screenshots are inlined as base64 so index.html is a single
  self-contained file (no CDN).
* Screenshots: PNGs in ./screenshots (exchange-liar, phone-approval, ledger, ...). A missing screenshot renders as a
  clean native mock with a small "Placeholder: screenshots/<name>.png" tag. Drop the file in and re-run.
* Numbers on the "what we built" slide are counted from the source tree at build time (../../server, ../../shared,
  ../../web/src). Strings from a captured live run are read from ./data/live.json when present.
"""
import base64
import glob
import io
import itertools
import json
import os
import re
import sys

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SHOT_DIR = os.path.join(HERE, "screenshots")
ASSET_DIR = os.path.join(HERE, "assets")
DATA_DIR = os.path.join(HERE, "data")

W, H = 13.333, 7.5  # inches, 16:9

# "Ledger Light" tokens (docs/DESIGN.md). Aliases keep slide markup readable: cyan/blue = agent, amber = fee.
C = {
    "bg": "FAFAF8", "panel": "FFFFFF", "raised": "F4F4F1", "line": "E9E8E3", "line2": "D9D8D1",
    "text": "0E0E10", "ink": "0E0E10", "muted": "5D5D66", "dim": "9A9AA3", "white": "FFFFFF",
    "accent": "F2561D", "accent_soft": "FFF0EA",
    "green": "12805C", "green_soft": "E7F6EF",
    "red": "D93036", "red_soft": "FDECEC",
    "amber": "A15C07", "amber_soft": "FFF4E2",
    "blue": "2F5BEA", "blue_soft": "EDF2FF",
    "neutral": "5D5D66", "neutral_soft": "F4F4F1",
    "code_bg": "0E0E10", "code_text": "E6E6E9", "code_dim": "8B8B94", "code_str": "7EE2B8", "code_num": "FFB08F", "code_fn": "9DB7FF",
}
C["cyan"] = C["blue"]
C["cyan_soft"] = C["blue_soft"]
SANS = "Inter"
MONO = "JetBrains Mono"
PANOSE = {SANS: ("020B0502030000000004", "34"), MONO: ("02000009000000000000", "49")}
GITHUB = "github.com/vnmoorthy/bidwire"
SHADOW_CARD = ("0E0E10", 0.07, 0.05, 0.012)
SHADOW_LIFT = ("0E0E10", 0.13, 0.42, 0.12)


def E(inches):
    return Emu(int(round(inches * 914400)))


def rgb(c):
    return RGBColor.from_string(C.get(c, c))


def hexc(c):
    return C.get(c, c)


def soft(c):
    return C.get(c + "_soft", "F4F4F1")


# --------------------------------------------------------------------------------------------------------------
# Facts counted from the code
# --------------------------------------------------------------------------------------------------------------
def src(rel):
    try:
        with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        return ""


def uniq(seq):
    out = []
    for x in seq:
        if x not in out:
            out.append(x)
    return out


def facts():
    tools, mcp, agent = src("server/src/tools.ts"), src("server/src/mcp.ts"), src("server/src/agent.ts")
    catalog, db, types, ex = src("server/src/catalog.ts"), src("server/src/db.ts"), src("shared/types.ts"), src("server/src/exchange.ts")
    head, _, tail = tools.partition("// ---- merchant side ----")
    f = {
        "buyer_tools": re.findall(r'name: "([a-z_]+)", title:', head)
        or ["find_offers", "get_offers", "buy_offer", "check_approval", "get_order", "get_wallet", "report_offer", "explain_offer"],
        "merchant_tools": re.findall(r'name: "([a-z_]+)", title:', tail)
        or ["register_merchant", "list_open_requests", "place_bid", "get_my_results"],
        "resources": re.findall(r'uri: "(bidwire://[a-z-]+)"', mcp) or ["bidwire://ranking-policy", "bidwire://categories", "bidwire://agent-guide"],
        "prompts": re.findall(r'server\.prompt\(\{ name: "([a-z_]+)"', mcp) or ["shop_for_me", "sell_on_bidwire"],
        "scenarios": re.findall(r'\{ id: "([a-z-]+)", title:', agent)
        or ["flight-headphones", "travel-charger", "sell-out", "office-monitor", "room-auction", "coffee"],
        "personas": re.findall(r'\{ name: "([^"]+)", handle: "[^"]+", strategy:', catalog) or ["x"] * 8,
        "products": len(re.findall(r'\{ sku: "', catalog)) or 26,
        "categories": sorted(set(re.findall(r'category: "([a-z]+)"', catalog))) or ["x"] * 6,
        "tables": re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", db) or ["x"] * 14,
        "events": re.findall(r'\| \{ type: "([a-z.]+)"', types) or ["x"] * 19,
        "checks": uniq(re.findall(r'checks\.push\(\{ name: "([^"]+)"', ex))
        or ["Product page", "Checkout total", "Delivery time", "Features", "In stock"],
        "buyers": re.findall(r'\{ id: "(b_[a-z]+)", name:', catalog) or ["x"] * 4,
    }
    m = re.search(r"RANKING_WEIGHTS = \{([^}]*)\}", ex)
    f["weights"] = {k: int(round(float(v) * 100)) for k, v in re.findall(r"(\w+): ([0-9.]+)", m.group(1))} if m else {
        "price": 40, "specs": 25, "delivery": 15, "trust": 15, "returns": 5}
    f["tools"] = f["buyer_tools"] + f["merchant_tools"]
    total = 0
    files = glob.glob(os.path.join(ROOT, "server/src/*.ts")) + glob.glob(os.path.join(ROOT, "shared/*.ts"))
    files += glob.glob(os.path.join(ROOT, "web/src/**/*.ts"), recursive=True) + glob.glob(os.path.join(ROOT, "web/src/**/*.tsx"), recursive=True)
    for p in files:
        if "node_modules" in p:
            continue
        with open(p, encoding="utf-8", errors="ignore") as fh:
            total += sum(1 for line in fh if line.strip())
    f["loc"] = total
    return f


def live_data():
    """Strings captured from a real demo run by capture.mjs (optional). Defaults are the verified live run of Oct 18."""
    d = {
        "bids": 7, "verified": 5, "excluded": 2, "bribe_rank": 5, "bribe_fee": "$35", "approval_amount": "$319.99",
        "approval_limit": "$300", "slow_days": 9, "deadline": 5,
        "lie1_merchant": "DealDrop Direct",
        "lie1": "Claimed $34.99 delivered · checkout says $63.99 (+$29.00 “Service & handling fee”)",
        "lie2_merchant": "Specsmith", "lie2": "Claims anc but the product page does not list it",
        "bribe_merchant": "MegaMart Ads Co.", "bribe_why": "Offered $35.00/sale to the exchange; fees never buy rank, so it stays #5",
        "soldout_next": "the next best verified offer",
    }
    p = os.path.join(DATA_DIR, "live.json")
    if os.path.exists(p):
        try:
            with open(p, encoding="utf-8") as fh:
                d.update({k: v for k, v in json.load(fh).items() if v not in (None, "")})
        except (OSError, ValueError):
            pass
    return d


def shot(name):
    p = os.path.join(SHOT_DIR, name + ".png")
    return p if os.path.exists(p) else None


# --------------------------------------------------------------------------------------------------------------
# Shape helpers
# --------------------------------------------------------------------------------------------------------------
TOKEN = re.compile(r"\[\[([a-z0-9_,#.]+)\|(.*?)\]\]")


def parse_runs(s, base):
    """'Bid[[accent|wire]]' -> runs. Keys: color name, b (bold), n (not bold), mono, i, s<size>."""
    out, pos = [], 0
    for m in TOKEN.finditer(s):
        if m.start() > pos:
            out.append((s[pos:m.start()], dict(base)))
        st = dict(base)
        for k in m.group(1).split(","):
            if k == "b":
                st["bold"] = True
            elif k == "n":
                st["bold"] = False
            elif k == "mono":
                st["font"] = MONO
            elif k == "sans":
                st["font"] = SANS
            elif k == "i":
                st["italic"] = True
            elif k.startswith("s") and k[1:].replace(".", "").isdigit():
                st["size"] = float(k[1:])
            elif k in C:
                st["color"] = k
            elif k.startswith("#"):
                st["color"] = k[1:]
        out.append((m.group(2), st))
        pos = m.end()
    if pos < len(s):
        out.append((s[pos:], dict(base)))
    return out


def style_run(r, st):
    f = r.font
    f.size = Pt(st["size"])
    f.bold = bool(st.get("bold"))
    f.italic = bool(st.get("italic"))
    f.color.rgb = rgb(st["color"])
    f.name = st["font"]
    rPr = r._r.get_or_add_rPr()
    latin = rPr.find(qn("a:latin"))
    pan = PANOSE.get(st["font"])
    if latin is not None and pan:
        latin.set("panose", pan[0])
        latin.set("pitchFamily", pan[1])
        latin.set("charset", "0")
    if st.get("spacing") is not None:
        rPr.set("spc", str(int(st["spacing"] * 100)))


def text(shapes, x, y, w, h, content, size=16, color="text", bold=False, font=SANS, align="l", anchor="t",
         spacing=None, line=None, after=0, italic=False, wrap=True, rot=0):
    tb = shapes.add_textbox(E(x), E(y), E(w), E(h))
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
    paras = content if isinstance(content, list) else content.split("\n")
    base = dict(size=size, color=color, bold=bold, font=font, italic=italic, spacing=spacing)
    for i, ptxt in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[align]
        pbase = dict(base)
        if isinstance(ptxt, tuple):
            ptxt, over = ptxt
            pbase.update(over)
        if line:
            p.line_spacing = line
        if pbase.get("after", after):
            p.space_after = Pt(pbase.get("after", after))
        if pbase.get("before"):
            p.space_before = Pt(pbase["before"])
        for t, st in parse_runs(ptxt, pbase):
            r = p.add_run()
            r.text = t
            style_run(r, st)
    if rot:
        tb.rotation = rot
    return tb


def strip_style(shape):
    st = shape._element.find(qn("p:style"))
    if st is not None:
        shape._element.remove(st)


def add_alpha(clr_el, alpha):
    for old in clr_el.findall(qn("a:alpha")):
        clr_el.remove(old)
    etree.SubElement(clr_el, qn("a:alpha")).set("val", str(int(alpha * 100000)))


def box(shapes, x, y, w, h, fill="panel", line=None, lw=0.75, r=0.1, alpha=None, line_alpha=None, kind=None, dash=None, rot=0):
    kind = kind or (MSO_SHAPE.ROUNDED_RECTANGLE if r else MSO_SHAPE.RECTANGLE)
    s = shapes.add_shape(kind, E(x), E(y), E(w), E(h))
    strip_style(s)
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = min(0.5, r / max(0.01, min(w, h)))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = rgb(fill)
        if alpha is not None:
            add_alpha(s._element.spPr.find(qn("a:solidFill"))[0], alpha)
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = rgb(line)
        s.line.width = Pt(lw)
        if dash:
            s.line.dash_style = dash
        if line_alpha is not None:
            add_alpha(s._element.spPr.find(qn("a:ln")).find(qn("a:solidFill"))[0], line_alpha)
    if rot:
        s.rotation = rot
    return s


def _insert_after_fill(spPr, el):
    for tags in (("a:ln",), ("a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"), ("a:prstGeom", "a:custGeom")):
        for tag in tags:
            found = spPr.find(qn(tag))
            if found is not None:
                found.addnext(el)
                return
    spPr.append(el)


def effects(shape, shadow=None):
    """shadow=(color, alpha, blur_in, dist_in): soft drop shadow, straight down."""
    spPr = shape._element.spPr
    old = spPr.find(qn("a:effectLst"))
    if old is not None:
        spPr.remove(old)
    eff = etree.Element(qn("a:effectLst"))
    if shadow:
        sh = etree.SubElement(eff, qn("a:outerShdw"))
        sh.set("blurRad", str(int(E(shadow[2]))))
        sh.set("dist", str(int(E(shadow[3]))))
        sh.set("dir", "5400000")
        sh.set("algn", "t")
        sh.set("rotWithShape", "0")
        c = etree.SubElement(sh, qn("a:srgbClr"))
        c.set("val", hexc(shadow[0]))
        add_alpha(c, shadow[1])
    _insert_after_fill(spPr, eff)


def arrow(shapes, x1, y1, x2, y2, color="line2", lw=1.25, head=True, dash=None):
    c = shapes.add_connector(MSO_CONNECTOR.STRAIGHT, E(x1), E(y1), E(x2), E(y2))
    strip_style(c)
    c.line.color.rgb = rgb(color)
    c.line.width = Pt(lw)
    if dash:
        c.line.dash_style = dash
    if head:
        ln = c.line._get_or_add_ln()
        t = etree.SubElement(ln, qn("a:tailEnd"))
        t.set("type", "triangle")
        t.set("w", "med")
        t.set("len", "med")
    return c


def picture(shapes, path, x, y, w, h, radius=0.05, focus=(0.5, 0.0), border=None, lw=0.75):
    with Image.open(path) as im:
        iw, ih = im.size
    pic = shapes.add_picture(path, E(x), E(y), E(w), E(h))
    ia, fa = iw / float(ih), w / float(h)
    if ia > fa + 1e-3:
        crop = 1 - fa / ia
        pic.crop_left = crop * focus[0]
        pic.crop_right = crop * (1 - focus[0])
    elif ia < fa - 1e-3:
        crop = 1 - ia / fa
        pic.crop_top = crop * focus[1]
        pic.crop_bottom = crop * (1 - focus[1])
    if radius:
        geom = pic._element.spPr.find(qn("a:prstGeom"))
        geom.set("prst", "roundRect")
        av = geom.find(qn("a:avLst"))
        if av is None:
            av = etree.SubElement(geom, qn("a:avLst"))
        gd = etree.SubElement(av, qn("a:gd"))
        gd.set("name", "adj")
        gd.set("fmla", "val %d" % int(min(50000, radius / min(w, h) * 100000)))
    if border:
        pic.line.color.rgb = rgb(border)
        pic.line.width = Pt(lw)
    return pic


def group(shapes):
    return shapes.add_group_shape()


def est_w(s, size, mono=False, bold=False):
    if mono:
        return len(s) * size * 0.6 / 72.0
    return len(s) * size * (0.56 if bold else 0.52) / 72.0


def badge(shapes, x, y, label, color="neutral", size=10, mono=False, h=0.3, pad=0.14, w=None, bold=True, outline=False):
    """Pill badge: soft background + solid text (DESIGN.md status badges)."""
    w = w or est_w(label, size, mono, bold) + pad * 2
    g = group(shapes)
    if outline:
        box(g.shapes, x, y, w, h, fill="panel", line="line2", lw=0.75, r=h / 2)
    else:
        box(g.shapes, x, y, w, h, fill=soft(color), r=h / 2)
    text(g.shapes, x, y, w, h, label, size=size, color=color if not outline else "muted", font=MONO if mono else SANS, align="c", anchor="m", bold=bold)
    return g, w


def card(shapes, x, y, w, h, fill="panel", line="line", r=0.12, accent=None, bar="left", lift=False):
    g = group(shapes)
    b = box(g.shapes, x, y, w, h, fill=fill, line=line, lw=0.75, r=r)
    effects(b, shadow=SHADOW_LIFT if lift else SHADOW_CARD)
    if accent:
        if bar == "left":
            box(g.shapes, x, y + 0.2, 0.045, h - 0.4, fill=accent, r=0)
        else:
            box(g.shapes, x + 0.22, y, w - 0.44, 0.04, fill=accent, r=0)
    return g


def eyebrow(shapes, x, y, w, s, color="dim", size=8.5, align="l"):
    return text(shapes, x, y, w, 0.24, s.upper(), size=size, bold=True, color=color, spacing=0.9, align=align, anchor="m")


def placeholder_tag(shapes, x, y, w, name):
    text(shapes, x, y, w, 0.2, "Placeholder: screenshots/%s.png" % name, size=7, color="dim", font=MONO, align="r", anchor="m")


def logo(shapes, x, y, size, dark=True):
    """Bidwire mark: ink rounded square, white rising wire, Signal Orange node."""
    g = group(shapes)
    k = size / 32.0
    box(g.shapes, x + 1 * k, y + 1 * k, 30 * k, 30 * k, fill="ink" if dark else "panel", line=None if dark else "line2", r=8 * k)
    pts = [(7, 21.5), (11.5, 15), (15.5, 18.5), (20, 11), (25, 11)]
    fb = g.shapes.build_freeform(pts[0][0], pts[0][1], scale=E(k))
    fb.add_line_segments(pts[1:], close=False)
    ff = fb.convert_to_shape(E(x), E(y))
    strip_style(ff)
    ff.fill.background()
    ff.line.color.rgb = rgb("white" if dark else "ink")
    ff.line.width = Pt(max(0.75, 2.6 * k * 72))
    ln = ff.line._get_or_add_ln()
    ln.set("cap", "rnd")
    sf = ln.find(qn("a:solidFill"))
    sf.addnext(etree.Element(qn("a:round")))
    box(g.shapes, x + (25 - 3.3) * k, y + (11 - 3.3) * k, 6.6 * k, 6.6 * k, fill="accent", kind=MSO_SHAPE.OVAL)
    return g


# --------------------------------------------------------------------------------------------------------------
# Native mocks (only when a screenshot is missing)
# --------------------------------------------------------------------------------------------------------------
def mock_exchange(g, x, y, w, h, L):
    s = g.shapes
    box(s, x, y, w, h, fill="bg", r=0.04)
    box(s, x, y, w, 0.34, fill="panel", r=0)
    box(s, x, y + 0.34, w, 0.01, fill="line", r=0)
    text(s, x + 0.18, y, 3, 0.34, "Bidwire  [[dim,n|Exchange]]", size=8.5, bold=True, anchor="m")
    by = y + 0.5
    box(s, x + 0.15, by, w - 0.3, 0.55, fill="red_soft", r=0.06)
    box(s, x + 0.15, by + 0.1, 0.035, 0.35, fill="red", r=0)
    text(s, x + 0.3, by + 0.04, w - 0.6, 0.24, "Caught lying · " + L["lie1_merchant"], size=9, bold=True, color="text", anchor="m")
    text(s, x + 0.3, by + 0.27, w - 0.6, 0.22, L["lie1"], size=7, color="muted", anchor="m")
    rows = [("#1", "Last Unit Labs", "#1 pick", "accent"), ("#2", "Parcel & Pine", "Verified", "green"),
            ("#3", "Northwind Electronics", "Verified", "green"), ("#4", "Sundial Supply", "Verified", "green"),
            ("#5", "MegaMart Ads Co.", "Bribe ignored", "amber"), ("—", "DealDrop Direct", "Lied", "red"),
            ("—", "Specsmith", "Lied", "red")]
    ty = by + 0.7
    box(s, x + 0.15, ty, w - 0.3, y + h - ty - 0.12, fill="panel", line="line", r=0.06)
    rh = (y + h - ty - 0.2) / len(rows)
    for i, (rk, name, tag, col) in enumerate(rows):
        yy = ty + 0.04 + i * rh
        if i:
            box(s, x + 0.2, yy, w - 0.4, 0.008, fill="line", r=0)
        text(s, x + 0.28, yy, 0.5, rh, rk, size=7.5, color="muted", anchor="m")
        text(s, x + 0.7, yy, w * 0.5, rh, name, size=8, bold=True, anchor="m")
        bw = est_w(tag, 7, False, True) + 0.18
        box(s, x + w - 0.3 - bw, yy + rh / 2 - 0.09, bw, 0.18, fill=soft(col), r=0.09)
        text(s, x + w - 0.3 - bw, yy + rh / 2 - 0.09, bw, 0.18, tag, size=7, bold=True, color=col, align="c", anchor="m")


def mock_phone(g, x, y, w, h, L):
    s = g.shapes
    box(s, x, y, w, h, fill="panel", r=0.26)
    text(s, x, y + 0.3, w, 0.25, "Bidwire", size=9, bold=True, align="c")
    box(s, x + 0.14, y + 0.75, w - 0.5, 1.7, fill="raised", r=0.14)
    text(s, x + 0.26, y + 0.85, w - 0.74, 1.55, "Your agent wants to buy Sennheiser Momentum 4 Wireless from Last Unit Labs for %s (your limit is %s). Reply YES 1234 to approve."
         % (L["approval_amount"], L["approval_limit"]), size=7.5, color="text", line=1.05)
    box(s, x + w - 0.95, y + 2.62, 0.8, 0.32, fill="ink", r=0.14)
    text(s, x + w - 0.95, y + 2.62, 0.8, 0.32, "YES 1234", size=8, bold=True, color="white", align="c", anchor="m")
    text(s, x + 0.15, y + 3.15, w - 0.3, 0.3, "Approved · purchase completed", size=7.5, bold=True, color="green", align="c")


def mock_ledger(g, x, y, w, h, L):
    s = g.shapes
    box(s, x, y, w, h, fill="panel", r=0.04)
    rows = [("buyer:b_claude:wallet", "−$319.99", "red"), ("merchant:last-unit:revenue", "+$319.99", "green"),
            ("merchant:last-unit:revenue", "−$5.00", "red"), ("platform:fees", "+$5.00", "green")]
    box(s, x, y, w, 0.3, fill="raised", r=0)
    text(s, x + 0.12, y, w - 0.24, 0.3, "Ledger · every transaction sums to $0.00", size=7, bold=True, color="muted", anchor="m")
    rh = (h - 0.4) / len(rows)
    for i, (acct, amt, col) in enumerate(rows):
        yy = y + 0.34 + i * rh
        if i:
            box(s, x + 0.1, yy, w - 0.2, 0.008, fill="line", r=0)
        text(s, x + 0.15, yy, w * 0.66, rh, acct, size=6.5, color="text", font=MONO, anchor="m")
        text(s, x + w - 1.0, yy, 0.85, rh, amt, size=7, color=col, bold=True, anchor="m", align="r")


# --------------------------------------------------------------------------------------------------------------
# Frames
# --------------------------------------------------------------------------------------------------------------
def browser(shapes, x, y, w, name, url, L, mock=mock_exchange, img_h=None, focus=(0.5, 0.0)):
    ih = img_h or (w - 0.02) * 9 / 16.0
    bar = 0.3
    g = group(shapes)
    s = g.shapes
    outer = box(s, x, y, w, bar + ih + 0.01, fill="panel", line="line", lw=0.75, r=0.12)
    effects(outer, shadow=SHADOW_LIFT)
    for i in range(3):
        box(s, x + 0.16 + i * 0.15, y + 0.11, 0.08, 0.08, fill="line2", kind=MSO_SHAPE.OVAL)
    box(s, x + w * 0.3, y + 0.065, w * 0.4, 0.17, fill="raised", r=0.085)
    text(s, x + w * 0.3, y + 0.065, w * 0.4, 0.17, url, size=7.5, color="muted", align="c", anchor="m")
    box(s, x + 0.01, y + bar - 0.01, w - 0.02, 0.01, fill="line", r=0)
    p = shot(name)
    if p:
        picture(s, p, x + 0.01, y + bar, w - 0.02, ih, radius=0.06, focus=focus)
    else:
        mock(g, x + 0.01, y + bar, w - 0.02, ih, L)
        placeholder_tag(s, x + 0.1, y + bar + ih - 0.24, w - 0.2, name)
    return g


def phone(shapes, x, y, h, name, L, mock=mock_phone):
    inset = 0.08
    sw = (h - 2 * inset) * 390 / 844.0
    w = sw + 2 * inset
    g = group(shapes)
    s = g.shapes
    outer = box(s, x, y, w, h, fill="ink", r=0.36)
    effects(outer, shadow=SHADOW_LIFT)
    p = shot(name)
    if p:
        picture(s, p, x + inset, y + inset, sw, h - 2 * inset, radius=0.29, focus=(0.5, 0.0))
    else:
        mock(g, x + inset, y + inset, sw, h - 2 * inset, L)
        placeholder_tag(s, x + 0.12, y + h - 0.34, w - 0.24, name)
    return g, w


# --------------------------------------------------------------------------------------------------------------
# Motion: transitions + entrance animations injected into the slide XML
# --------------------------------------------------------------------------------------------------------------
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


class Motion(object):
    def __init__(self):
        self.fx = []

    def add(self, shape, kind="rise", delay=0, dur=500):
        self.fx.append((shape, kind, int(delay), int(dur)))
        return shape


def _tgt(spid):
    return '<p:tgtEl><p:spTgt spid="%d"/></p:tgtEl>' % spid


def _vis(i, spid):
    return ('<p:set><p:cBhvr><p:cTn id="%d" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>%s'
            '<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
            % (i, _tgt(spid)))


def _filter(i, spid, dur, flt="fade"):
    return '<p:animEffect transition="in" filter="%s"><p:cBhvr><p:cTn id="%d" dur="%d"/>%s</p:cBhvr></p:animEffect>' % (flt, i, dur, _tgt(spid))


def _prop(i, spid, dur, attr, v0, v1):
    return ('<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="%d" dur="%d" fill="hold" decel="100000"/>%s'
            '<p:attrNameLst><p:attrName>%s</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>'
            '<p:tav tm="0"><p:val><p:strVal val="%s"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="%s"/></p:val></p:tav>'
            '</p:tavLst></p:anim>' % (i, dur, _tgt(spid), attr, v0, v1))


def _effect(ids, shape, kind, delay, dur):
    spid = shape.shape_id
    cid = next(ids)
    if kind == "fade":
        preset, sub = 10, 0
        body = _vis(next(ids), spid) + _filter(next(ids), spid, dur)
    elif kind in ("rise", "drop"):
        preset, sub = 42, 0
        off = "#ppt_y+0.025" if kind == "rise" else "#ppt_y-0.025"
        body = (_vis(next(ids), spid) + _filter(next(ids), spid, dur)
                + _prop(next(ids), spid, dur, "ppt_x", "#ppt_x", "#ppt_x") + _prop(next(ids), spid, dur, "ppt_y", off, "#ppt_y"))
    elif kind == "slide":  # in from the left
        preset, sub = 42, 0
        body = (_vis(next(ids), spid) + _filter(next(ids), spid, dur)
                + _prop(next(ids), spid, dur, "ppt_x", "#ppt_x-0.02", "#ppt_x") + _prop(next(ids), spid, dur, "ppt_y", "#ppt_y", "#ppt_y"))
    elif kind == "wipe":
        preset, sub = 22, 8
        body = _vis(next(ids), spid) + _filter(next(ids), spid, dur, "wipe(left)")
    elif kind in ("zoom", "stamp"):
        preset, sub = 53, 16
        k = "1.35" if kind == "stamp" else "0.85"
        body = (_vis(next(ids), spid) + _filter(next(ids), spid, int(dur * 0.6))
                + _prop(next(ids), spid, dur, "ppt_w", "#ppt_w*" + k, "#ppt_w") + _prop(next(ids), spid, dur, "ppt_h", "#ppt_h*" + k, "#ppt_h"))
    else:
        raise ValueError(kind)
    return ('<p:par><p:cTn id="%d" presetID="%d" presetClass="entr" presetSubtype="%d" fill="hold" grpId="0" nodeType="withEffect">'
            '<p:stCondLst><p:cond delay="%d"/></p:stCondLst><p:childTnLst>%s</p:childTnLst></p:cTn></p:par>' % (cid, preset, sub, delay, body))


def apply_motion(slide, motion, transition="fade", speed="med"):
    sld = slide._element
    tr = {"fade": "<p:fade/>", "push": '<p:push dir="u"/>', "wipe": '<p:wipe dir="r"/>', "cover": '<p:cover dir="l"/>'}[transition]
    tr_el = etree.fromstring('<p:transition xmlns:p="%s" spd="%s">%s</p:transition>' % (P_NS, speed, tr))
    anchor = sld.find(qn("p:clrMapOvr"))
    if anchor is None:
        anchor = sld.find(qn("p:cSld"))
    anchor.addnext(tr_el)
    if not motion.fx:
        return
    ids = itertools.count(5)
    eff = "".join(_effect(ids, s, k, d, u) for s, k, d, u in motion.fx)
    bld, seen = "", set()
    for s, _, _, _ in motion.fx:
        el = s._element
        if el.tag == qn("p:sp") and el.find(qn("p:txBody")) is not None and s.shape_id not in seen:
            bld += '<p:bldP spid="%d" grpId="0" animBg="1"/>' % s.shape_id
            seen.add(s.shape_id)
    xml = ('<p:timing xmlns:p="%s" xmlns:a="%s"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
           '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
           '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>'
           '</p:stCondLst><p:childTnLst><p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>%s'
           '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'
           '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
           '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
           '</p:childTnLst></p:cTn></p:par></p:tnLst>%s</p:timing>') % (P_NS, A_NS, eff, ("<p:bldLst>%s</p:bldLst>" % bld) if bld else "")
    tr_el.addnext(etree.fromstring(xml))


# --------------------------------------------------------------------------------------------------------------
# Slide chrome
# --------------------------------------------------------------------------------------------------------------
def chrome(slide, n, kicker, m):
    s = slide.shapes
    logo(s, 0.75, 0.44, 0.28)
    text(s, 1.11, 0.4, 2.5, 0.36, "Bidwire", size=13, bold=True, anchor="m", spacing=-0.2)
    text(s, 6.583, 0.4, 6.0, 0.36, "%s   [[line2||]]   [[dim,n|%d / 10]]" % (kicker.upper(), n), size=8.5, bold=True, color="muted", align="r",
         anchor="m", spacing=0.9)
    text(s, 0.75, 7.0, 7.0, 0.26, "Bidwire · YC Make Something Agents Want · Oct 18, 2026", size=8.5, color="dim", anchor="m")
    text(s, 7.583, 7.0, 5.0, 0.26, GITHUB, size=8.5, color="dim", align="r", anchor="m")
    box(s, 0, 7.465, W, 0.035, fill="line", r=0)
    bar = box(s, 0, 7.465, W * n / 10.0, 0.035, fill="accent", r=0)
    m.add(bar, "wipe", 0, 600)


def headline(slide, s, m, y=0.95, size=38, h=1.0, delay=60, sub=None, sub_y=None, sub_size=17):
    t = text(slide.shapes, 0.75, y, 11.85, h, s, size=size, bold=True, line=0.98, spacing=-0.8)
    m.add(t, "rise", delay, 600)
    if sub:
        st = text(slide.shapes, 0.75, sub_y or (y + h + 0.02), 11.85, 0.45, sub, size=sub_size, color="muted")
        m.add(st, "fade", delay + 200, 500)
    return t


def kpi_strip(shapes, x, y, w, h, items, m, delay, vertical=False, vsize=24):
    """KPI tiles inside ONE card separated by dividers (DESIGN.md)."""
    g = card(shapes, x, y, w, h)
    m.add(g, "rise", delay, 500)
    n = len(items)
    for i, (v, lab, col) in enumerate(items):
        if vertical:
            cy = y + i * h / n
            if i:
                box(shapes, x + 0.2, cy, w - 0.4, 0.01, fill="line", r=0)
            gg = group(shapes)
            text(gg.shapes, x + 0.25, cy + 0.12, w - 0.4, 0.5, v, size=vsize, bold=True, color=col, anchor="m", spacing=-0.4)
            text(gg.shapes, x + 0.25, cy + 0.62, w - 0.45, h / n - 0.68, lab, size=10, color="muted", line=1.02)
        else:
            cx = x + i * w / n
            if i:
                box(shapes, cx, y + 0.14, 0.01, h - 0.28, fill="line", r=0)
            gg = group(shapes)
            text(gg.shapes, cx + 0.25, y, w / n - 0.3, h, "[[%s,b,s%d|%s]]   %s" % (col, vsize, v, lab), size=11, color="muted", anchor="m")
        m.add(gg, "rise", delay + 150 + i * 110, 450)


def weights_bar(shapes, x, y, w, h, Wt, m=None, delay=0, size=9):
    order = [("price", "Price", "0E0E10", "FFFFFF"), ("specs", "Must-haves", "3A3A41", "FFFFFF"), ("delivery", "Delivery", "6E6E78", "FFFFFF"),
             ("trust", "Trust", "A3A3AC", "0E0E10"), ("returns", "Ret.", "D6D6DB", "0E0E10")]
    total = float(sum(Wt.values())) or 100.0
    cx = x
    for i, (k, lab, col, tc) in enumerate(order):
        ww = w * Wt.get(k, 0) / total
        g = group(shapes)
        box(g.shapes, cx, y, ww - 0.025, h, fill=col, r=0.03)
        txt = "%s %d" % (lab, Wt.get(k, 0)) if ww > 0.95 else "%d" % Wt.get(k, 0)
        text(g.shapes, cx, y, ww - 0.025, h, txt, size=size, bold=True, color=tc, align="c", anchor="m")
        if m is not None:
            m.add(g, "wipe", delay + i * 120, 400)
        cx += ww


# --------------------------------------------------------------------------------------------------------------
# Slides
# --------------------------------------------------------------------------------------------------------------
NOTES = {
    1: "Hi, this is Bidwire: the ad exchange for AI agents. Here's the thing. When an agent shops, nobody sees an ad. "
       "No banner, no sponsored slot, no clever copy. So the only way a merchant can win an agent's purchase is with an offer "
       "that's actually true. Bidwire is the marketplace that makes that happen, live, over MCP.",
    2: "Agents can already shop for us. But the commerce stack they land on was built to manipulate humans: sponsored slots, "
       "SEO games, drip pricing where $34.99 on the page becomes $63.99 at checkout, and specs nobody checks. Agents read those "
       "pages and get gamed. Merchants have the opposite problem: there is no ad slot inside a tool call, so they can't reach agents at all.",
    3: "Our insight: for an agent, the ad IS the offer. So instead of buying attention, merchants bid with claims a machine can check: "
       "delivered price, delivery time, features. We verify every claim, rank on merit with public weights, and fees can't buy rank. "
       "The YC prompt was to rebuild a tool built for humans. Google became Exa for search; this is Google Ads, rebuilt for agents.",
    4: "Here's the flow. The agent calls one tool, find_offers, with its need, budget and deadline. That opens a twelve-second live "
       "auction where bots, people in this room and merchant agents bid. We fetch each merchant's real product page and checkout, run "
       "five checks, exclude liars, and rank on merit. buy_offer pays from a prepaid wallet; over the limit, the human gets a text and "
       "replies YES. Everything settles in a double-entry ledger.",
    5: "This ran live today. One auction: seven bids, five verified, two excluded for lying. One hid a service fee at checkout, one "
       "claimed noise cancelling on headphones that don't have it. A merchant offered thirty-five dollars a sale and stayed at number five. "
       "A nine-day shipper got ranked down for missing a five-day deadline, and the $319.99 pick went to the human's phone for a YES. "
       "If a merchant sells out mid-purchase, the agent gets the next best offer and recovers on its own.",
    6: "We built Bidwire as an MCP server on mcp-use from Manufact: twelve tools, three resources, two prompts. The happy path is two "
       "calls: find_offers, then buy_offer. Errors come back structured, with a hint that tells the agent what to call next. Buys take "
       "idempotency keys. The first call needs zero config: no key makes you a guest agent. And the same server works in Claude Code, "
       "Claude Desktop, ChatGPT, Codex and Cursor.",
    7: "Trust is the product, so it's enforced in code. Every bid gets five checks against the merchant's own page and checkout; a liar is "
       "excluded and loses trust for every agent. The ranking weights are public: price forty, must-haves twenty-five, delivery fifteen, "
       "trust fifteen, returns five, fees zero. Spending limits come from the human, every transaction in the ledger sums to zero, and every "
       "tool call is logged on the Agent Wire.",
    8: "Business model: merchants pay a fee only when a verified sale happens. Pay-per-sale, no impressions, no clicks, and that fee is our "
       "take. The wedge is DTC merchants and agent shopping apps; the long game is the trust layer for agent commerce. Why now: eighteen "
       "months ago there was no MCP, no ACP, and no agent had a card. This year agents got wallets and protocols. Search ads are a "
       "two-hundred-billion-dollar-plus business built on human attention, and agents don't look at ads.",
    9: "All of this was built in twenty-four hours and it's running right now: an MCP server on mcp-use and Hono, SQLite, a live board "
       "over server-sent events, real storefront pages with schema.org JSON-LD that the verifier fetches over HTTP, eight merchant bots "
       "with honest and dishonest strategies, and Inkbox for approval texts and receipts. Every number on the right is counted from the code.",
    10: "So that's Bidwire. When agents do the shopping, attention stops being for sale, and the truth becomes the only thing worth "
        "bidding on. You can't bribe an agent. The code is on GitHub at vnmoorthy slash bidwire. The exchange is live right now: connect "
        "your agent and buy something, or join from your phone and try to bribe it. Thank you.",
}


def s1_title(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    sh = s.shapes
    g = group(sh)
    pill = box(g.shapes, 0.8, 0.66, 4.55, 0.36, fill="panel", line="line", r=0.18)
    box(g.shapes, 0.97, 0.795, 0.09, 0.09, fill="accent", kind=MSO_SHAPE.OVAL)
    text(g.shapes, 1.14, 0.66, 4.2, 0.36, "Live  ·  YC Make Something Agents Want  ·  Oct 18, 2026", size=9.5, color="muted", anchor="m")
    m.add(g, "fade", 0, 450)
    m.add(logo(sh, 0.82, 1.55, 0.92), "zoom", 120, 500)
    m.add(text(sh, 1.95, 1.36, 5.4, 1.3, "Bidwire", size=80, bold=True, anchor="m", spacing=-2.4), "rise", 200, 650)
    m.add(text(sh, 0.8, 2.92, 6.3, 0.62, "The ad exchange for AI agents.", size=30, bold=True, spacing=-0.6), "rise", 380, 600)
    m.add(text(sh, 0.8, 3.72, 6.1, 1.0, ["When agents shop, nobody sees an ad.", ("So merchants have to tell the truth.", {"color": "text"})],
               size=20, color="muted", line=1.15), "rise", 560, 600)
    chips = [("find_offers → buy_offer", "blue", True), ("Every bid verified", "green", False), ("Fees never buy rank", "amber", False),
             ("Live 12-second auctions", "accent", False)]
    cx, cy = 0.8, 5.0
    for i, (lab, col, mono) in enumerate(chips):
        if i == 2:
            cx, cy = 0.8, 5.42
        gch, wch = badge(sh, cx, cy, lab, col, size=10, mono=mono, h=0.32)
        m.add(gch, "rise", 800 + i * 90, 450)
        cx += wch + 0.1
    m.add(text(sh, 0.8, 6.3, 6.3, 0.3, "Built with mcp-use (Manufact) · Inkbox · MCP over streamable HTTP", size=9.5, color="dim"),
          "fade", 1250, 500)

    fr = browser(sh, 7.35, 1.25, 6.55, "exchange-liar", "localhost:8787/exchange", L)
    m.add(fr, "rise", 420, 800)

    cg = group(sh)
    c = box(cg.shapes, 6.75, 4.78, 5.1, 1.5, fill="panel", line="line", r=0.14)
    effects(c, shadow=SHADOW_LIFT)
    box(cg.shapes, 6.97, 5.0, 0.42, 0.42, fill="red_soft", kind=MSO_SHAPE.OVAL)
    text(cg.shapes, 6.97, 5.0, 0.42, 0.42, "✗", size=13, bold=True, color="red", align="c", anchor="m")
    text(cg.shapes, 7.55, 4.95, 3.3, 0.3, "Caught lying · " + L["lie1_merchant"], size=13.5, bold=True, anchor="m")
    text(cg.shapes, 7.55, 5.27, 4.15, 0.48, L["lie1"], size=10.5, color="muted", line=1.05)
    text(cg.shapes, 7.55, 5.86, 4.15, 0.28, "Live run: a headless Claude Code agent over MCP saw it and bought the #1 verified offer.", size=8.5, color="dim")
    bw = 0.78
    bdg = box(cg.shapes, 10.85, 4.98, bw, 0.3, fill="red_soft", r=0.15)
    text(cg.shapes, 10.85, 4.98, bw, 0.3, "Lied ✗", size=10, bold=True, color="red", align="c", anchor="m")
    m.add(cg, "stamp", 1500, 350)
    s.notes_slide.notes_text_frame.text = NOTES[1]
    apply_motion(s, m, "fade")


def s2_problem(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 2, "The problem", m)
    sh = s.shapes
    headline(s, "Agents can shop now. [[muted|The web was built to manipulate humans.]]", m, size=38, h=1.05)
    m.add(text(sh, 0.75, 2.2, 7, 0.26, "What the web does to shoppers", size=11, bold=True, color="muted", anchor="m"), "fade", 200, 400)
    cards = [("Ad", "Sponsored slots", "Placement goes to whoever pays the most."),
             ("SEO", "Ranking games", "Rank goes to whoever games the algorithm best."),
             ("+$29", "Drip pricing", "$34.99 on the page. $63.99 at checkout."),
             ("ANC?", "Fake specs", "“Noise cancelling” on headphones that don't have it.")]
    for i, (ic, t, d) in enumerate(cards):
        x = 0.75 + (i % 2) * 3.72
        y = 2.58 + (i // 2) * 1.86
        g = card(sh, x, y, 3.52, 1.68)
        gs = g.shapes
        iw = 0.58 if len(ic) < 4 else 0.72
        box(gs, x + 0.25, y + 0.25, iw, 0.42, fill="red_soft", r=0.1)
        text(gs, x + 0.25, y + 0.25, iw, 0.42, ic, size=11, bold=True, color="red", align="c", anchor="m")
        text(gs, x + 0.25, y + 0.82, 3.1, 0.34, t, size=16, bold=True, anchor="m")
        text(gs, x + 0.25, y + 1.17, 3.1, 0.42, d, size=11.5, color="muted", line=1.05)
        m.add(g, "rise", 300 + i * 100, 500)
    ag = group(sh)
    box(ag.shapes, 8.14, 3.93, 0.44, 0.44, fill="panel", line="line2", kind=MSO_SHAPE.OVAL)
    text(ag.shapes, 8.14, 3.93, 0.44, 0.44, "→", size=15, color="muted", align="c", anchor="m")
    m.add(ag, "zoom", 800, 350)
    m.add(text(sh, 8.85, 2.2, 3.8, 0.26, "What breaks", size=11, bold=True, color="muted", anchor="m"), "fade", 850, 400)
    breaks = [("blue", "Agents get gamed", "They read the same pages and trust the same claims. Nobody checks the checkout."),
              ("amber", "Merchants can't reach agents", "There's no ad slot inside a tool call. Banners and SEO never reach a shopping agent.")]
    for i, (col, t, d) in enumerate(breaks):
        y = 2.58 + i * 1.86
        g = card(sh, 8.85, y, 3.73, 1.68, accent=col)
        text(g.shapes, 9.12, y + 0.24, 3.35, 0.36, t, size=16, bold=True, anchor="m")
        text(g.shapes, 9.12, y + 0.66, 3.33, 0.9, d, size=11.5, color="muted", line=1.06)
        m.add(g, "rise", 950 + i * 130, 500)
    m.add(text(sh, 0.75, 6.32, 11.85, 0.45,
               "Agents need offers they can [[text,b|verify]]. Merchants need a way to [[text,b|compete]] for an agent's purchase.",
               size=17, color="muted"), "rise", 1300, 600)
    s.notes_slide.notes_text_frame.text = NOTES[2]
    apply_motion(s, m, "fade")


def s3_insight(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 3, "The insight", m)
    sh = s.shapes
    m.add(text(sh, 0.75, 0.98, 11.85, 1.0, "For an agent, [[accent|the ad is the offer.]]", size=54, bold=True, spacing=-1.6, anchor="m"), "rise", 60, 650)
    m.add(text(sh, 0.75, 2.02, 11.85, 0.45, "So merchants bid with claims a machine can check, and we check every one.", size=19, color="muted"), "fade", 300, 500)
    cols = [("1", "Bid with verifiable claims",
             "Delivered price, delivery days and features, checked against the merchant's own product page (schema.org JSON-LD) and live checkout."),
            ("2", "Rank on merit",
             "Verified offers are scored 0–100 with public weights. Agents can read the policy as an MCP resource."),
            ("3", "Fees can't buy rank",
             "A merchant pays its fee only when an agent buys, and the fee only breaks near-ties (under 0.5 merit points).")]
    for i, (num, t, d) in enumerate(cols):
        x = 0.75 + i * 4.015
        y = 2.78
        g = card(sh, x, y, 3.8, 3.0)
        gs = g.shapes
        box(gs, x + 0.28, y + 0.28, 0.36, 0.36, fill="ink", kind=MSO_SHAPE.OVAL)
        text(gs, x + 0.28, y + 0.28, 0.36, 0.36, num, size=11, bold=True, color="white", align="c", anchor="m")
        text(gs, x + 0.28, y + 0.78, 3.3, 0.4, t, size=18, bold=True, anchor="m", spacing=-0.3)
        text(gs, x + 0.28, y + 1.24, 3.26, 1.1, d, size=11.5, color="muted", line=1.1)
        m.add(g, "rise", 500 + i * 150, 550)
        vy = y + 2.38
        if i == 0:
            cx = x + 0.28
            for j, lab in enumerate(["Price ✓", "Ship days ✓", "Features ✓"]):
                gc, wc = badge(sh, cx, vy, lab, "green", size=9.5, h=0.32)
                m.add(gc, "zoom", 1100 + j * 100, 300)
                cx += wc + 0.08
        elif i == 1:
            weights_bar(sh, x + 0.28, vy, 3.24, 0.32, F["weights"], m, 1150, size=8)
        else:
            gc, wc = badge(sh, x + 0.28, vy, "Bribe ignored", "amber", size=9.5, h=0.32)
            m.add(gc, "stamp", 1550, 300)
            m.add(text(sh, x + 0.28 + wc + 0.12, vy, 2.0, 0.32, "%s/sale, still #%s" % (L["bribe_fee"], L["bribe_rank"]), size=10, color="muted", anchor="m"),
                  "fade", 1650, 300)
    g = card(sh, 0.75, 6.06, 11.83, 0.62)
    text(g.shapes, 1.0, 6.06, 11.4, 0.62,
         "[[muted|YC prompt: rebuild a tool that was built for humans.]]      Search: Google → Exa      ·      Ads: Google Ads → [[text,b|Bidwire]]",
         size=13, color="text", anchor="m")
    m.add(g, "fade", 1850, 500)
    s.notes_slide.notes_text_frame.text = NOTES[3]
    apply_motion(s, m, "fade")


def s4_flow(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 4, "How it works", m)
    sh = s.shapes
    headline(s, "One tool call in. [[muted|A verified, merit-ranked purchase out.]]", m, size=34, h=0.65)
    wt = F["weights"]
    steps = [("blue", "find_offers", True, "The agent sends its need, budget, deadline and must-haves."),
             ("blue", "Live auction", False, "About 12 seconds. Bots, people on phones and merchant agents bid."),
             ("green", "Verify", False, "Fetch the product page JSON-LD and the checkout quote. %d checks." % len(F["checks"])),
             ("green", "Rank on merit", False, "Price %d, must-haves %d, delivery %d, trust %d, returns %d." % (
                 wt.get("price", 40), wt.get("specs", 25), wt.get("delivery", 15), wt.get("trust", 15), wt.get("returns", 5))),
             ("blue", "buy_offer", True, "Pays from the agent's prepaid wallet. Idempotent."),
             ("amber", "Spending policy", False, "Over the limit? Inkbox texts the human: “Reply YES 1234”."),
             ("green", "Ledger + receipt", False, "Double-entry. Every transaction sums to $0.")]
    cw, gap, x0, y0, chh = 1.515, 0.205, 0.75, 1.95, 2.35
    tags = {2: ("red", "Lied ✗", "Excluded. Trust −12 for every agent."),
            3: ("amber", "Bribe ignored", "Fees only break near-ties."),
            4: ("blue", "Sold out", "out_of_stock + next best offer. The agent recovers."),
            5: ("green", "Approved", "The human replies YES 1234.")}
    for i, (col, t, mono, d) in enumerate(steps):
        x = x0 + i * (cw + gap)
        g = card(sh, x, y0, cw, chh)
        gs = g.shapes
        box(gs, x + 0.16, y0 + 0.18, 0.32, 0.32, fill=soft(col), kind=MSO_SHAPE.OVAL)
        text(gs, x + 0.16, y0 + 0.18, 0.32, 0.32, str(i + 1), size=10, bold=True, color=col, align="c", anchor="m")
        text(gs, x + 0.16, y0 + 0.62, cw - 0.26, 0.5, t, size=12 if mono else 13.5, bold=True, font=MONO if mono else SANS,
             color="blue" if mono else "text", anchor="t", line=0.95)
        text(gs, x + 0.16, y0 + 1.15, cw - 0.28, 1.15, d, size=10, color="muted", line=1.08)
        m.add(g, "rise", 250 + i * 140, 450)
        if i < len(steps) - 1:
            a = arrow(sh, x + cw + 0.03, y0 + chh / 2, x + cw + gap - 0.025, y0 + chh / 2, color="line2", lw=1.5)
            m.add(a, "wipe", 350 + i * 140, 220)
        if i in tags:
            tc, tt, td = tags[i]
            ln = arrow(sh, x + cw / 2, y0 + chh + 0.03, x + cw / 2, y0 + chh + 0.33, color="line2", lw=1.0, head=False, dash=MSO_LINE_DASH_STYLE.DASH)
            tg = group(sh)
            box(tg.shapes, x, y0 + chh + 0.35, cw, 1.12, fill=soft(tc), r=0.12)
            text(tg.shapes, x + 0.14, y0 + chh + 0.45, cw - 0.22, 0.26, tt, size=10, bold=True, color=tc, anchor="m")
            text(tg.shapes, x + 0.14, y0 + chh + 0.74, cw - 0.24, 0.7, td, size=9.5, color="text", line=1.05)
            m.add(ln, "fade", 1450 + (i - 2) * 140, 250)
            m.add(tg, "rise", 1500 + (i - 2) * 140, 400)
    kpi_strip(sh, 0.75, 6.15, 11.83, 0.66, [("2", "calls for the agent", "text"), ("~12 s", "live auction", "text"),
                                             (str(len(F["checks"])), "checks per bid", "green"), ("0%", "of rank for sale", "amber")],
              m, 2100, vsize=20)
    s.notes_slide.notes_text_frame.text = NOTES[4]
    apply_motion(s, m, "fade")


def s5_demo(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 5, "Live demo highlights", m)
    sh = s.shapes
    headline(s, "Live today: [[muted|liars caught, bribes ignored, a human in the loop.]]", m, size=30, h=0.55)
    m.add(text(sh, 0.75, 1.58, 6.6, 0.26, "Exchange board · caught lying", size=10.5, bold=True, color="muted", anchor="m"), "fade", 150, 400)
    fr = browser(sh, 0.75, 1.9, 6.6, "exchange-liar", "localhost:8787/exchange", L)
    m.add(fr, "rise", 200, 700)
    ev = [("amber", "Bribe ignored", L["bribe_merchant"], L["bribe_why"]),
          ("blue", "Sold out, recovered", "buy_offer", "out_of_stock + next_offer: the agent buys %s on its own." % L["soldout_next"])]
    for i, (col, tag, who, d) in enumerate(ev):
        x = 0.75 + i * 3.36
        g = card(sh, x, 6.05, 3.24, 0.86)
        bw = est_w(tag, 8.5, False, True) + 0.24
        box(g.shapes, x + 0.15, 6.15, bw, 0.24, fill=soft(col), r=0.12)
        text(g.shapes, x + 0.15, 6.15, bw, 0.24, tag, size=8.5, bold=True, color=col, align="c", anchor="m")
        text(g.shapes, x + 0.25 + bw, 6.15, 3.24 - bw - 0.35, 0.24, who, size=8.5, bold=True, color="muted", font=MONO if who == "buy_offer" else SANS, anchor="m")
        text(g.shapes, x + 0.15, 6.44, 2.98, 0.45, d, size=9, color="text", line=1.03)
        m.add(g, "rise", 950 + i * 130, 450)
    m.add(text(sh, 7.62, 1.58, 2.6, 0.26, "Approver phone · SMS", size=10.5, bold=True, color="muted", anchor="m"), "fade", 300, 400)
    pg, pw = phone(sh, 7.62, 1.9, 5.0, "phone-approval", L)
    m.add(pg, "rise", 350, 700)
    sx = 7.62 + pw + 0.28
    kpi_strip(sh, sx, 1.9, 12.583 - sx, 5.0,
              [("%s → %s" % (L["bids"], L["verified"]), "bids → verified", "green"),
               (str(L["excluded"]), "excluded for lying: a hidden fee and a fake ANC claim", "red"),
               ("#%s" % L["bribe_rank"], "where the %s/sale bribe stayed" % L["bribe_fee"], "amber"),
               (L["approval_amount"], "over the %s limit, so the human texted YES" % L["approval_limit"], "blue")],
              m, 1100, vertical=True, vsize=26)
    s.notes_slide.notes_text_frame.text = NOTES[5]
    apply_motion(s, m, "fade")


def flow_badges(shapes, x, y, w, items, color, size=9.5, h=0.29, gapx=0.08, gapy=0.08, m=None, delay=0, step=35, outline=False):
    cx, cy = x, y
    for i, it in enumerate(items):
        cw = est_w(it, size, True) + 0.24
        if cx + cw > x + w + 0.01 and cx > x:
            cx, cy = x, cy + h + gapy
        g, _ = badge(shapes, cx, cy, it, color, size=size, mono=True, h=h, pad=0.12, bold=False, outline=outline)
        if m is not None:
            m.add(g, "fade", delay + i * step, 250)
        cx += cw + gapx
    return cy + h


def s6_agents(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 6, "Built for agents · Manufact track", m)
    sh = s.shapes
    headline(s, "One MCP server. Two calls. [[muted|Every client.]]", m, size=34, h=0.62)
    lx, lw_ = 0.75, 5.3
    lp = card(sh, lx, 1.75, lw_, 5.08)
    m.add(lp, "rise", 200, 500)
    text(lp.shapes, lx + 0.25, 1.9, 4.8, 0.3, "The MCP surface", size=12, bold=True, anchor="m")
    kx = lx + 0.25
    for i, (v, lab) in enumerate([(len(F["tools"]), "tools"), (len(F["resources"]), "resources"), (len(F["prompts"]), "prompts")]):
        if i:
            box(lp.shapes, kx - 0.2, 2.35, 0.01, 0.55, fill="line", r=0)
        text(lp.shapes, kx, 2.28, 1.6, 0.7, "[[text,b,s30|%d]]  %s" % (v, lab), size=11, color="muted", anchor="m")
        kx += 1.65
    yb = 3.12
    m.add(text(sh, lx + 0.25, yb, 4.8, 0.24, "Buyer agents · %d" % len(F["buyer_tools"]), size=9.5, bold=True, color="muted", anchor="m"), "fade", 400, 300)
    yb = flow_badges(sh, lx + 0.25, yb + 0.3, lw_ - 0.45, F["buyer_tools"], "blue", m=m, delay=450)
    m.add(text(sh, lx + 0.25, yb + 0.14, 4.8, 0.24, "Merchant agents · %d" % len(F["merchant_tools"]), size=9.5, bold=True, color="muted", anchor="m"),
          "fade", 750, 300)
    yb = flow_badges(sh, lx + 0.25, yb + 0.44, lw_ - 0.45, F["merchant_tools"], "neutral", m=m, delay=800)
    m.add(text(sh, lx + 0.25, yb + 0.14, 4.8, 0.24, "Resources and prompts", size=9.5, bold=True, color="muted", anchor="m"), "fade", 950, 300)
    yb = flow_badges(sh, lx + 0.25, yb + 0.44, lw_ - 0.45, F["resources"] + F["prompts"], "neutral", m=m, delay=1000, outline=True)
    m.add(text(sh, lx + 0.25, 6.38, 4.8, 0.3, "Built on mcp-use (Manufact) · TypeScript · streamable HTTP at /mcp", size=9, color="dim", anchor="m"),
          "fade", 1200, 400)
    rx = lx + lw_ + 0.25
    rw = 12.583 - rx
    cg = group(sh)
    cb = box(cg.shapes, rx, 1.75, rw, 2.6, fill="code_bg", r=0.14)
    effects(cb, shadow=SHADOW_LIFT)
    text(cg.shapes, rx + 0.25, 1.82, rw - 0.5, 0.34, "Two calls from any MCP client", size=9.5, bold=True, color="code_dim", anchor="m")
    box(cg.shapes, rx, 2.2, rw, 0.01, fill="2A2A30", r=0)
    m.add(cg, "rise", 300, 500)
    code = ["[[code_dim|→]] [[code_fn,b|find_offers]]({ need: [[code_str|\"noise cancelling headphones\"]],",
            "                budget_usd: [[code_num|400]], deliver_within_days: [[code_num|5]] })",
            "[[code_dim|← %s bids → %s verified · %s excluded for lying · ranked]]" % (L["bids"], L["verified"], L["excluded"]),
            "[[code_dim|→]] [[code_fn,b|buy_offer]]({ offer_id: [[code_str|\"bid_…\"]] })",
            "[[code_dim|← approval_required → human texts YES →]] [[code_str,b|purchased ✓]]"]
    for i, ln in enumerate(code):
        t = text(sh, rx + 0.25, 2.35 + i * 0.38, rw - 0.4, 0.34, ln, size=10.5, color="code_text", font=MONO, anchor="m", wrap=False)
        m.add(t, "wipe", 800 + i * 230, 380)
    feats = [("Zero-config first call", "No key = guest agent. Claude, ChatGPT and Codex auto-map to demo agents."),
             ("Errors with hints", "{ error, message, hint } tells the agent what to call next."),
             ("Idempotency keys", "Retries never double-buy. Same offer twice returns the same order."),
             ("Per-caller keys", "Bearer bw_buy_… for shoppers, bw_mer_… for merchant agents."),
             ("Waits, doesn't poll", "find_offers waits for the auction; buy_offer waits for the human's YES."),
             ("Every client", "Claude Code · Claude Desktop · ChatGPT · Codex · Cursor")]
    tw = (rw - 0.24) / 3.0
    for i, (t, d) in enumerate(feats):
        x = rx + (i % 3) * (tw + 0.12)
        y = 4.55 + (i // 3) * 1.17
        g = card(sh, x, y, tw, 1.06)
        text(g.shapes, x + 0.16, y + 0.12, tw - 0.3, 0.3, t, size=11, bold=True, anchor="m")
        text(g.shapes, x + 0.16, y + 0.43, tw - 0.3, 0.6, d, size=9, color="muted", line=1.03)
        m.add(g, "rise", 1900 + i * 90, 400)
    s.notes_slide.notes_text_frame.text = NOTES[6]
    apply_motion(s, m, "fade")


def s7_trust(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 7, "Trust & safety", m)
    sh = s.shapes
    headline(s, "Trust is enforced in code.", m, size=36, h=0.62, sub="Every claim checked. Every cent balanced. Every call logged.", sub_y=1.56)
    lp = card(sh, 0.75, 2.2, 5.6, 4.66)
    m.add(lp, "rise", 250, 500)
    text(lp.shapes, 1.0, 2.36, 5, 0.3, "%d checks on every bid" % len(F["checks"]), size=12, bold=True, anchor="m")
    detail = {"Product page": "schema.org Offer found on the merchant's own page",
              "Checkout total": "claimed delivered price ≥ the real checkout total",
              "Delivery time": "claimed days ≥ the store's real ship days",
              "Features": "every claimed feature is listed on the page",
              "In stock": "available on the page and at checkout"}
    for i, name in enumerate(F["checks"][:5]):
        y = 2.76 + i * 0.64
        g = group(sh)
        box(g.shapes, 1.0, y + 0.08, 0.4, 0.4, fill="green_soft", kind=MSO_SHAPE.OVAL)
        text(g.shapes, 1.0, y + 0.08, 0.4, 0.4, "✓", size=12, bold=True, color="green", align="c", anchor="m")
        text(g.shapes, 1.58, y + 0.03, 4.5, 0.28, "%d. %s" % (i + 1, name), size=13.5, bold=True, anchor="m")
        text(g.shapes, 1.58, y + 0.3, 4.6, 0.26, detail.get(name, ""), size=10.5, color="muted", anchor="m")
        m.add(g, "slide", 450 + i * 120, 400)
    wg = group(sh)
    box(wg.shapes, 1.0, 6.08, 5.1, 0.58, fill="red_soft", r=0.1)
    text(wg.shapes, 1.18, 6.08, 4.85, 0.58, "[[red,b|Fail checks 1–4: excluded.]] Trust −12, visible to every agent on the exchange.", size=10.5,
         color="text", anchor="m")
    m.add(wg, "rise", 1150, 400)
    rp = card(sh, 6.6, 2.2, 5.98, 1.78)
    m.add(rp, "rise", 400, 500)
    text(rp.shapes, 6.85, 2.36, 5.5, 0.3, "Merit, not money · public weights", size=12, bold=True, anchor="m")
    weights_bar(sh, 6.85, 2.78, 5.48, 0.42, F["weights"], m, 800, size=9)
    fg = group(sh)
    box(fg.shapes, 6.85, 3.36, 0.5, 0.2, fill="panel", line="amber", lw=1.0, r=0.04, dash=MSO_LINE_DASH_STYLE.DASH)
    text(fg.shapes, 7.48, 3.31, 4.9, 0.3, "[[amber,b|Merchant fee: 0.]] Paid only on a sale; only breaks ties under 0.5 points.", size=10, color="muted", anchor="m")
    m.add(fg, "fade", 1450, 400)
    fr = browser(sh, 6.6, 4.18, 3.72, "ledger", "localhost:8787/ledger", L, mock=mock_ledger, focus=(0.5, 0.0))
    m.add(fr, "rise", 900, 550)
    m.add(text(sh, 6.6, 6.55, 3.72, 0.3, "[[green,b|Double-entry ledger:]] every transaction sums to $0", size=9.5, color="muted", anchor="m"), "fade", 1350, 400)
    side = [("amber", "Spending policy", "Per-purchase and daily limits from the human. Above them: SMS “Reply YES 1234”."),
            ("blue", "Keys + Agent Wire", "Per-caller keys. Every tool call logged: client, tool, args, ms, tokens.")]
    for i, (col, t, d) in enumerate(side):
        y = 4.18 + i * 1.36
        g = card(sh, 10.5, y, 2.08, 1.25, accent=col)
        text(g.shapes, 10.7, y + 0.13, 1.83, 0.3, t, size=11, bold=True, anchor="m")
        text(g.shapes, 10.7, y + 0.43, 1.8, 0.8, d, size=9, color="muted", line=1.03)
        m.add(g, "rise", 1100 + i * 130, 400)
    s.notes_slide.notes_text_frame.text = NOTES[7]
    apply_motion(s, m, "fade")


def s8_business(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 8, "Business model · Why now", m)
    sh = s.shapes
    headline(s, "Merchants pay [[muted|only when an agent buys.]]", m, size=36, h=0.62)
    lp = card(sh, 0.75, 1.78, 5.95, 5.08)
    m.add(lp, "rise", 200, 500)
    text(lp.shapes, 1.0, 1.95, 5.4, 0.3, "Business model", size=12, bold=True, anchor="m")
    nodes = [("Agent wallet", "blue_soft", "blue"), ("Merchant", "raised", "text"), ("Bidwire", "ink", "white")]
    for i, (n, fill, tc) in enumerate(nodes):
        x = 1.0 + i * 1.9
        g = group(sh)
        box(g.shapes, x, 2.42, 1.5, 0.6, fill=fill, r=0.3)
        text(g.shapes, x, 2.42, 1.5, 0.6, n, size=12, bold=True, color=tc, align="c", anchor="m")
        m.add(g, "zoom", 450 + i * 220, 350)
        if i < 2:
            a = arrow(sh, x + 1.53, 2.72, x + 1.87, 2.72, color="line2", lw=1.5)
            m.add(a, "wipe", 580 + i * 220, 220)
            text(sh, x + 1.36, 3.06, 0.66, 0.24, ["price", "fee"][i], size=9, bold=True, color=["muted", "amber"][i], align="c", anchor="m")
    m.add(text(sh, 1.0, 3.3, 5.45, 0.26, "The fee is charged only on a verified sale.", size=9.5, color="amber", align="r", anchor="m"), "fade", 1000, 400)
    bullets = [("green", "CPA, not CPM.", "The fee a merchant bids is charged only when an agent buys a verified offer."),
               ("amber", "That fee is our take rate.", "No impressions. No clicks. No pay-to-rank."),
               ("blue", "Wedge:", "DTC merchants and agent shopping apps."),
               ("accent", "Long game:", "the trust and reputation layer for agent commerce.")]
    for i, (col, b, d) in enumerate(bullets):
        y = 3.78 + i * 0.74
        g = group(sh)
        box(g.shapes, 1.0, y + 0.1, 0.1, 0.1, fill=col, kind=MSO_SHAPE.OVAL)
        text(g.shapes, 1.25, y, 5.2, 0.7, "[[text,b|%s]] %s" % (b, d), size=12.5, color="muted", line=1.08)
        m.add(g, "rise", 1100 + i * 120, 400)
    rp = card(sh, 6.95, 1.78, 5.63, 5.08)
    m.add(rp, "rise", 350, 500)
    text(rp.shapes, 7.2, 1.95, 5.2, 0.3, "Why now", size=12, bold=True, anchor="m")
    tl = [("18 months ago", "line2", "No MCP. No ACP. No agent had a credit card or a login.", "YC kickoff"),
          ("This year", "blue", "Agents got wallets and protocols: MCP and ACP.", ""),
          ("Now", "accent", "Paul Graham: Amazon banning agents is the biggest opening since Amazon. People will want agents to buy things for them.", "paraphrased")]
    vline = box(sh, 7.315, 2.55, 0.02, 2.2, fill="line", r=0)
    m.add(vline, "fade", 600, 300)
    for i, (when, col, d, src_) in enumerate(tl):
        y = 2.4 + i * 1.02
        g = group(sh)
        box(g.shapes, 7.23, y + 0.06, 0.19, 0.19, fill=col, line="panel", lw=2, kind=MSO_SHAPE.OVAL)
        text(g.shapes, 7.62, y, 4.7, 0.3, when + ("   [[dim,n|%s]]" % src_ if src_ else ""), size=11, bold=True, color="text", anchor="m")
        text(g.shapes, 7.62, y + 0.3, 4.75, 0.7, d, size=11.5, color="muted", line=1.06)
        m.add(g, "rise", 700 + i * 200, 450)
    cg = group(sh)
    box(cg.shapes, 7.2, 5.55, 5.13, 1.08, fill="amber_soft", r=0.12)
    text(cg.shapes, 7.42, 5.6, 4.75, 0.98,
         "[[amber,b|Search ads are a ~$200B+/yr business]] built on human attention. Agents don't look at ads, so that spend has to compete on verifiable offers.",
         size=11, color="text", line=1.08, anchor="m")
    m.add(cg, "rise", 1450, 450)
    s.notes_slide.notes_text_frame.text = NOTES[8]
    apply_motion(s, m, "fade")


def s9_built(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    chrome(s, 9, "What we built in 24h", m)
    sh = s.shapes
    headline(s, "Built in 24 hours. [[muted|Running live.]]", m, size=36, h=0.62)
    m.add(text(sh, 0.75, 1.75, 2.0, 0.26, "Agents (MCP)", size=10, bold=True, color="muted", anchor="m"), "fade", 200, 300)
    for i, c in enumerate(["Claude Code", "Claude Desktop", "ChatGPT", "Codex", "Cursor"]):
        g, _ = badge(sh, 0.75, 2.07 + i * 0.42, c, "blue", size=10, h=0.33, w=1.95)
        m.add(g, "slide", 250 + i * 60, 300)
    m.add(text(sh, 0.75, 4.25, 2.0, 0.26, "Merchants", size=10, bold=True, color="muted", anchor="m"), "fade", 550, 300)
    for i, c in enumerate(["%d bot personas" % len(F["personas"]), "People on phones", "Merchant agents"]):
        g, _ = badge(sh, 0.75, 4.57 + i * 0.42, c, "neutral", size=10, h=0.33, w=1.95)
        m.add(g, "slide", 600 + i * 60, 300)
    for y in (3.1, 5.0):
        a = arrow(sh, 2.78, y, 3.12, y, color="line2", lw=1.5)
        m.add(a, "wipe", 850, 220)
    sp = card(sh, 3.15, 1.75, 3.05, 5.1)
    m.add(sp, "rise", 800, 500)
    box(sp.shapes, 3.15, 1.75, 3.05, 0.04, fill="ink", r=0)
    text(sp.shapes, 3.35, 1.92, 2.7, 0.3, "Bidwire server", size=12.5, bold=True, anchor="m")
    text(sp.shapes, 3.35, 2.2, 2.7, 0.3, "mcp-use v2 · Hono · TypeScript", size=9.5, color="muted", anchor="m")
    rows = [("/mcp", "%d tools · %d resources · %d prompts" % (len(F["tools"]), len(F["resources"]), len(F["prompts"]))),
            ("tools.ts", "one registry: MCP, browser playground, demo agent"),
            ("exchange.ts", "auction · verify · rank · policy · ledger"),
            ("SQLite", "%d tables, plain rows" % len(F["tables"])),
            ("SSE bus", "%d live event types" % len(F["events"]))]
    for i, (k, d) in enumerate(rows):
        y = 2.68 + i * 0.8
        g = group(sh)
        box(g.shapes, 3.35, y, 2.65, 0.68, fill="raised", r=0.08)
        text(g.shapes, 3.5, y + 0.05, 2.4, 0.28, k, size=10, bold=True, color="text", font=MONO, anchor="m")
        text(g.shapes, 3.5, y + 0.33, 2.42, 0.32, d, size=8.5, color="muted", anchor="m")
        m.add(g, "fade", 1000 + i * 100, 300)
    outs = [("green", "Web app", "Landing · exchange · merchant phone · approver phone · ledger · connect · director", 1.75, 1.45),
            ("blue", "Storefronts", "/store/:handle/:sku with schema.org JSON-LD + /quote. The verifier fetches them over HTTP.", 3.4, 1.55),
            ("amber", "Inkbox", "Agent identity: approval SMS (“Reply YES 1234”) and email receipts.", 5.15, 1.32)]
    for i, (col, t, d, y, hh) in enumerate(outs):
        if i == 1:
            a = arrow(sh, 6.23, y + hh / 2 - 0.08, 6.5, y + hh / 2 - 0.08, color="line2", lw=1.5)
            a2 = arrow(sh, 6.5, y + hh / 2 + 0.08, 6.23, y + hh / 2 + 0.08, color="blue", lw=1.25)
            m.add(a2, "wipe", 1700, 220)
        else:
            a = arrow(sh, 6.23, y + hh / 2, 6.5, y + hh / 2, color="line2", lw=1.5)
        m.add(a, "wipe", 1550 + i * 110, 220)
        g = card(sh, 6.52, y, 2.0, hh, accent=col)
        text(g.shapes, 6.72, y + 0.13, 1.75, 0.3, t, size=12, bold=True, anchor="m")
        text(g.shapes, 6.72, y + 0.43, 1.72, hh - 0.48, d, size=8.5, color="muted", line=1.04)
        m.add(g, "rise", 1600 + i * 130, 400)
    nums = [(str(len(F["tools"])), "MCP tools"), ("%d + %d" % (len(F["resources"]), len(F["prompts"])), "resources + prompts"),
            (str(len(F["scenarios"])), "demo scenarios"), (str(len(F["personas"])), "merchant bot personas"),
            (str(len(F["checks"])), "verification checks"), (str(len(F["weights"])), "ranking factors"),
            (str(F["products"]), "real products in %d categories" % len(F["categories"])), (str(len(F["buyers"])), "buyer agents"),
            (str(len(F["tables"])), "SQLite tables"), ("{:,}".format(F["loc"]), "lines of TypeScript")]
    m.add(text(sh, 8.85, 1.75, 3.7, 0.26, "Counted from the code", size=10, bold=True, color="muted", anchor="m"), "fade", 1800, 300)
    ng = card(sh, 8.85, 2.07, 3.73, 4.78)
    m.add(ng, "rise", 1850, 450)
    for i, (v, lab) in enumerate(nums):
        x = 8.85 + (i % 2) * 1.865
        y = 2.07 + (i // 2) * 0.956
        if i % 2:
            box(sh, x, y + 0.15, 0.01, 0.66, fill="line", r=0)
        if i >= 2 and i % 2 == 0:
            box(sh, 8.95, y, 3.53, 0.01, fill="line", r=0)
        g = group(sh)
        text(g.shapes, x + 0.2, y + 0.1, 1.6, 0.46, v, size=22, bold=True, color="text", anchor="m", spacing=-0.4)
        text(g.shapes, x + 0.2, y + 0.55, 1.6, 0.34, lab, size=8.5, color="muted", anchor="m")
        m.add(g, "rise", 1950 + i * 70, 350)
    s.notes_slide.notes_text_frame.text = NOTES[9]
    apply_motion(s, m, "fade")


def s10_close(prs, F, L, new_slide):
    s = new_slide()
    m = Motion()
    sh = s.shapes
    m.add(logo(sh, 0.85, 0.95, 0.66), "zoom", 0, 450)
    m.add(text(sh, 1.7, 0.95, 4, 0.66, "Bidwire", size=26, bold=True, anchor="m", spacing=-0.6), "fade", 100, 400)
    m.add(text(sh, 0.8, 1.95, 11.9, 1.45, "You can't bribe [[accent|an agent.]]", size=72, bold=True, spacing=-2.4, anchor="m"), "rise", 250, 700)
    m.add(text(sh, 0.85, 3.5, 11.5, 0.5, "Bidwire is the ad exchange for AI agents: verified offers, merit ranking, pay per sale.", size=21, color="muted"),
          "fade", 650, 500)
    # GitHub as the primary (ink) action
    gg = group(sh)
    b = box(gg.shapes, 0.85, 4.45, 3.77, 1.42, fill="ink", r=0.14)
    effects(b, shadow=SHADOW_LIFT)
    text(gg.shapes, 1.1, 4.6, 3.3, 0.26, "GITHUB", size=8.5, bold=True, color="code_dim", spacing=0.9, anchor="m")
    text(gg.shapes, 1.1, 4.92, 3.35, 0.8, GITHUB, size=14.5, bold=True, color="white", font=MONO, line=1.05)
    m.add(gg, "rise", 950, 450)
    cards = [("Try it live", "Point any MCP client at /mcp. Two calls: [[mono,text|find_offers]] → [[mono,text|buy_offer]]."),
             ("The ask", "Merchants: pilot pay-per-sale. Agent builders: plug in find_offers.")]
    for i, (lab, body) in enumerate(cards):
        x = 0.85 + (i + 1) * 3.97
        g = card(sh, x, 4.45, 3.77, 1.42)
        if i == 0:
            box(g.shapes, x + 0.25, 4.67, 0.09, 0.09, fill="accent", kind=MSO_SHAPE.OVAL)
        text(g.shapes, x + 0.25 + (0.18 if i == 0 else 0), 4.6, 3.2, 0.26, lab.upper(), size=8.5, bold=True, color="dim", spacing=0.9, anchor="m")
        text(g.shapes, x + 0.25, 4.92, 3.35, 0.85, body, size=13, color="text", line=1.08)
        m.add(g, "rise", 1100 + i * 150, 450)
    m.add(text(sh, 0.85, 6.35, 11.8, 0.32, "Built at YC “Make Something Agents Want” · with mcp-use (Manufact) and Inkbox · by @vnmoorthy",
               size=10, color="dim", anchor="m"), "fade", 1500, 450)
    box(sh, 0, 7.465, W, 0.035, fill="accent", r=0)
    s.notes_slide.notes_text_frame.text = NOTES[10]
    apply_motion(s, m, "fade", "slow")


def build_pptx(F, L, out):
    prs = Presentation()
    prs.slide_width, prs.slide_height = E(W), E(H)
    blank = prs.slide_layouts[6]

    def new_slide():
        sl = prs.slides.add_slide(blank)
        sl.background.fill.solid()
        sl.background.fill.fore_color.rgb = rgb("bg")
        return sl

    for fn in (s1_title, s2_problem, s3_insight, s4_flow, s5_demo, s6_agents, s7_trust, s8_business, s9_built, s10_close):
        fn(prs, F, L, new_slide)
    prs.core_properties.title = "Bidwire: the ad exchange for AI agents"
    prs.core_properties.author = "Bidwire"
    prs.core_properties.subject = "YC Make Something Agents Want, Oct 18 2026"
    prs.save(out)
    chk = Presentation(out)  # validate: re-open
    n_notes = sum(1 for sl in chk.slides if sl.has_notes_slide and sl.notes_slide.notes_text_frame.text.strip())
    n_tr = sum(1 for sl in chk.slides if sl._element.find(qn("p:transition")) is not None)
    n_tm = sum(1 for sl in chk.slides if sl._element.find(qn("p:timing")) is not None)
    n_fx = sum(len(sl._element.findall(".//" + qn("p:par"))) for sl in chk.slides)
    print("pptx: %s  slides=%d notes=%d transitions=%d animated=%d timing-nodes=%d (%.1f MB)" % (
        out, len(chk.slides), n_notes, n_tr, n_tm, n_fx, os.path.getsize(out) / 1e6))


# --------------------------------------------------------------------------------------------------------------
# HTML deck: inline fonts + screenshots into index.src.html
# --------------------------------------------------------------------------------------------------------------
def data_uri_jpeg(path, max_w=1920, quality=85):
    with Image.open(path) as im:
        im = im.convert("RGB")
        if im.width > max_w:
            im = im.resize((max_w, int(im.height * max_w / float(im.width))), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def build_html(F, L, out):
    with open(os.path.join(HERE, "index.src.html"), encoding="utf-8") as fh:
        html = fh.read()
    faces = []
    fonts = [("Inter", w, "inter-latin-%d-normal.woff2" % w) for w in (400, 500, 600, 700, 800)]
    fonts += [("JetBrains Mono", w, "jetbrains-mono-latin-%d-normal.woff2" % w) for w in (400, 500, 700)]
    for fam, wt, fn in fonts:
        p = os.path.join(ASSET_DIR, "fonts", fn)
        if os.path.exists(p):
            with open(p, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode("ascii")
            faces.append("@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}"
                         % (fam, wt, b64))
    html = html.replace("/*{{FONTS}}*/", "\n".join(faces))

    def shot_sub(mo):
        name = mo.group(1)
        p = shot(name)
        if not p:
            return ""
        return data_uri_jpeg(p, max_w=900 if name.startswith(("phone", "merchant")) else 1920)

    html = re.sub(r"\{\{SHOT:([a-z0-9-]+)\}\}", shot_sub, html)
    wt = F["weights"]
    vals = {
        "tools": len(F["tools"]), "buyer_tools": len(F["buyer_tools"]), "merchant_tools": len(F["merchant_tools"]),
        "resources": len(F["resources"]), "prompts": len(F["prompts"]), "scenarios": len(F["scenarios"]),
        "personas": len(F["personas"]), "products": F["products"], "categories": len(F["categories"]), "tables": len(F["tables"]),
        "events": len(F["events"]), "checks": len(F["checks"]), "buyers": len(F["buyers"]), "loc": F["loc"], "loc_fmt": "{:,}".format(F["loc"]),
        "w_price": wt.get("price", 40), "w_specs": wt.get("specs", 25), "w_delivery": wt.get("delivery", 15),
        "w_trust": wt.get("trust", 15), "w_returns": wt.get("returns", 5),
    }
    html = re.sub(r"\{\{FACT:([a-z_]+)\}\}", lambda mo: str(vals.get(mo.group(1), "")), html)

    def esc(v):
        return str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    html = re.sub(r"\{\{LIVE:([a-z0-9_]+)\}\}", lambda mo: esc(L.get(mo.group(1), "")), html)
    html = html.replace("{{NOTES_JSON}}", json.dumps({str(k): v for k, v in NOTES.items()}).replace("</", "<\\/"))
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(html)
    left = re.findall(r"\{\{[A-Z]+:[a-z0-9_-]+\}\}", html)
    print("html: %s  (%.1f MB)%s" % (out, os.path.getsize(out) / 1e6, ("  UNFILLED: %s" % left) if left else ""))


def main():
    args = set(sys.argv[1:])
    F, L = facts(), live_data()
    print("facts: tools=%d (%d buyer + %d merchant) resources=%d prompts=%d scenarios=%d personas=%d products=%d categories=%d "
          "tables=%d events=%d checks=%d buyers=%d loc=%d weights=%s" % (
              len(F["tools"]), len(F["buyer_tools"]), len(F["merchant_tools"]), len(F["resources"]), len(F["prompts"]), len(F["scenarios"]),
              len(F["personas"]), F["products"], len(F["categories"]), len(F["tables"]), len(F["events"]), len(F["checks"]),
              len(F["buyers"]), F["loc"], F["weights"]))
    missing = [n for n in ("exchange-liar", "phone-approval", "ledger") if not shot(n)]
    if missing:
        print("placeholders (screenshot missing): " + ", ".join(missing))
    if "--html" not in args or "--pptx" in args:
        build_pptx(F, L, os.path.join(HERE, "Bidwire.pptx"))
    if "--pptx" not in args or "--html" in args:
        if os.path.exists(os.path.join(HERE, "index.src.html")):
            build_html(F, L, os.path.join(HERE, "index.html"))
        else:
            print("html: index.src.html not found, skipped")


if __name__ == "__main__":
    main()
