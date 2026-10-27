import fitz
doc = fitz.open("/home/z/my-project/upload/C205.pdf")
page = doc[50]
bands = {}
for d in page.get_drawings():
    r = d["rect"]
    key = int(r.y0 // 20) * 20
    bands.setdefault(key, [0, 999, -1])
    b = bands[key]
    b[0] += 1
    b[1] = min(b[1], r.x0); b[2] = max(b[2], r.x1)
for k in sorted(bands):
    print(f"y~{k:3d}: n={bands[k][0]:3d} x=[{bands[k][1]:.0f},{bands[k][2]:.0f}]")
doc.close()
