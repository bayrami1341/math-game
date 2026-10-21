import fitz, sys
doc = fitz.open("/home/z/my-project/upload/C205.pdf")
pno1, y0, y1 = int(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
page = doc[pno1-1]
d = page.get_text("rawdict")
out=[]
for b in d["blocks"]:
    if b.get("type")!=0: continue
    for l in b["lines"]:
        for s in l["spans"]:
            for c in s["chars"]:
                x,y = c["origin"][0], c["origin"][1]
                if y0 <= y <= y1:
                    out.append((x, c["c"]))
out.sort(key=lambda a:-a[0])
print(" ".join(f"[{ch}@{x:.0f}]" for x,ch in out))
doc.close()
