"""Render PARTNER-DECK.md (one slide per page, speaker notes omitted) and RATE-CARD.md to
branded HTML, then to PDF with headless Chrome. Run: python3 docs/partners/pdf/build.py"""
import re, html, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "docs/partners/pdf"
LOGO = f'<img src="file://{ROOT}/apps/web/public/logos/nullshift-wordmark.png" alt="Nullshift">'

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    t = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', t)
    return t

def md_to_html(lines):
    out, i = [], 0
    while i < len(lines):
        l = lines[i].rstrip()
        if not l.strip():
            i += 1; continue
        if l.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            rows = [r for r in rows if not all(re.fullmatch(r":?-+:?", c) for c in r)]
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in rows[0]) + "</tr></thead><tbody>" +
                       "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows[1:]) + "</tbody></table>")
            continue
        m = re.match(r"^(#{1,4})\s+(.*)", l)
        if m:
            out.append(f"<h{len(m.group(1))}>{inline(m.group(2))}</h{len(m.group(1))}>"); i += 1; continue
        if re.match(r"^\s*[-*]\s+", l):
            out.append("<ul>")
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                item = re.sub(r"^\s*[-*]\s+", "", lines[i].rstrip()); i += 1
                while i < len(lines) and lines[i].startswith("  ") and not re.match(r"^\s*[-*]\s+", lines[i]):
                    item += " " + lines[i].strip(); i += 1
                out.append(f"<li>{inline(item)}</li>")
            out.append("</ul>"); continue
        if re.match(r"^\s*\d+\.\s+", l):
            out.append("<ol>")
            while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
                out.append(f"<li>{inline(re.sub(r'^\s*\d+\.\s+', '', lines[i].rstrip()))}</li>"); i += 1
            out.append("</ol>"); continue
        para = [l.strip()]; i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#|\||\s*[-*]\s|\s*\d+\.\s|---)", lines[i]):
            para.append(lines[i].strip()); i += 1
        if para[0] != "---": out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)

CSS = """
@page { size: A4 landscape; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font-family: -apple-system, Inter, "Helvetica Neue", Arial, sans-serif; color: #f4f4e8; background: #0a0a0a }
.slide { width: 297mm; height: 210mm; padding: 18mm 20mm 16mm; page-break-after: always; position: relative; display: flex; flex-direction: column; background: #0a0a0a }
.slide:last-child { page-break-after: auto }
.brand { position: absolute; top: 10mm; left: 20mm; height: 7mm; width: 40mm; opacity: .95 }
.brand img { height: 100%; width: auto }
.num { position: absolute; top: 11mm; right: 20mm; font-family: "Roboto Mono", monospace; font-size: 9pt; color: #6a6a62; letter-spacing: .1em }
.foot { position: absolute; bottom: 9mm; left: 20mm; right: 20mm; font-size: 8pt; color: #6a6a62; display: flex; justify-content: space-between; border-top: 1px solid rgba(244,244,232,.14); padding-top: 3mm }
h2 { font-size: 26pt; line-height: 1.1; margin: 8mm 0 5mm; font-weight: 600; letter-spacing: -.01em; max-width: 90% }
h3 { font-size: 13pt; margin: 4mm 0 2mm; color: #10b981; text-transform: uppercase; letter-spacing: .08em; font-weight: 600 }
p { font-weight: 400; font-size: 12.5pt; line-height: 1.45; margin: 0 0 3.5mm; max-width: 92% }
p strong:first-child:only-child, .lead { color: #10b981 }
ul, ol { margin: 0 0 4mm; padding-left: 6mm; font-size: 12.5pt; line-height: 1.5 }
li { margin-bottom: 1.6mm; font-weight: 400 }
li::marker { color: #10b981 }
table { border-collapse: collapse; width: 100%; font-size: 11pt; margin: 2mm 0 4mm }
th { text-align: left; color: #9a9a90; font-weight: 600; font-size: 9pt; text-transform: uppercase; letter-spacing: .08em; padding: 2mm 3mm; border-bottom: 1px solid rgba(244,244,232,.28) }
td { font-weight: 400; padding: 2.2mm 3mm; border-bottom: 1px solid rgba(244,244,232,.14); vertical-align: top }
code { font-family: "Roboto Mono", monospace; font-size: .9em; color: #9a9a90 }
a { color: #10b981; text-decoration: none }
.cover h2 { font-size: 40pt; margin-top: 30mm }
.cover .lead { font-size: 16pt }
/* portrait doc */
.doc { background: #f4f4e8; color: #0a0a0a; width: 210mm; min-height: 297mm; padding: 18mm 20mm }
.doc h1 { font-size: 24pt; margin: 0 0 2mm } .doc h2 { font-size: 15pt; margin: 8mm 0 2mm; color: #0a0a0a }
.doc h3 { color: #047857 } .doc p, .doc li { font-size: 10.5pt } .doc ul { padding-left: 5mm }
.doc th { color: #4b4b44; border-bottom-color: #0a0a0a } .doc td { border-bottom-color: rgba(10,10,10,.15) }
.doc code { color: #4b4b44 } .doc a { color: #047857 } .doc .brand { position: static; height: 7mm; margin-bottom: 8mm } .doc .brand img { filter: invert(1) }
@media print { .doc { page-break-after: always } }
"""

def deck():
    src = (ROOT / "docs/partners/PARTNER-DECK.md").read_text().splitlines()
    slides = re.split(r"^## (Slide \d+ — .*)$", "\n".join(src), flags=re.M)
    pages = []
    for n in range(1, len(slides), 2):
        title = slides[n].split(" — ", 1)[1]
        body = slides[n + 1]
        body = re.sub(r"\*\*Speaker notes\.\*\*.*?(?=\n---|\Z)", "", body, flags=re.S)
        cls = "slide cover" if n == 1 else "slide"
        pages.append(f'<section class="{cls}"><div class="brand">{LOGO}</div><div class="num">{(n+1)//2:02d} / {len(slides)//2:02d}</div>'
                     f'<h2>{inline(title)}</h2>{md_to_html(body.splitlines())}'
                     f'<div class="foot"><span>Nullshift Development Ltd · nullshift.co.uk/partners</span><span>Partner programme · October 2026 · prices exclude VAT</span></div></section>')
    (OUT / "Nullshift-Partner-Deck.html").write_text(f"<!doctype html><meta charset=utf-8><title>Nullshift Partner Deck</title><style>{CSS}</style>" + "".join(pages))

def ratecard():
    src = (ROOT / "docs/partners/RATE-CARD.md").read_text().splitlines()
    body = md_to_html(src)
    (OUT / "Nullshift-Partner-Rate-Card.html").write_text(
        f"<!doctype html><meta charset=utf-8><title>Nullshift Partner Rate Card</title><style>{CSS} @page {{ size: A4 portrait; margin: 0 }} body{{background:#f4f4e8}}</style>"
        f'<article class="doc"><div class="brand">{LOGO}</div>{body}</article>')

deck(); ratecard()
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for name in ("Nullshift-Partner-Deck", "Nullshift-Partner-Rate-Card"):
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--no-margins",
                    f"--print-to-pdf={OUT / (name + '.pdf')}", f"file://{OUT / (name + '.html')}"], check=True, capture_output=True)
    print("wrote", OUT / (name + ".pdf"))
