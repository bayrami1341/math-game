import fitz, sys, json
doc = fitz.open("/home/z/my-project/upload/C205.pdf")
start, end = int(sys.argv[1]), int(sys.argv[2])  # 1-based pdf pages
for pno in range(start-1, end):
    page = doc[pno]
    d = page.get_text("dict")
    spans = []
    for b in d["blocks"]:
        if b.get("type") != 0: continue
        for l in b["lines"]:
            for s in l["spans"]:
                t = s["text"].strip()
                if not t: continue
                spans.append((round(s["bbox"][1]), round(-s["bbox"][0]), round(s["size"],1), s["font"], t))
    spans.sort()
    imgs = len(page.get_images(full=True))
    drw = page.get_drawings()
    print(f"\n===== PDF page {pno+1} (index {pno}) ===== images={imgs} drawings={len(drw)}")
    for y, nx, size, font, t in spans:
        print(f"y={y:4d} x={-nx:4d} sz={size:4.1f} [{font[:18]:18s}] {t}")
doc.close()
