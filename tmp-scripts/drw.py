import fitz, sys
doc = fitz.open("/home/z/my-project/upload/C205.pdf")
pno1, y0, y1, x0, x1 = [float(x) for x in sys.argv[1:6]] if len(sys.argv)>5 else (int(sys.argv[1]),0,0,0,0)
page = doc[int(pno1)-1]
n=0
for d in page.get_drawings():
    r = d["rect"]
    if y0 <= r.y0 <= y1 and x0 <= r.x0 <= x1:
        n+=1
        if n<=40: print(f"  ({r.x0:.0f},{r.y0:.0f})-({r.x1:.0f},{r.y1:.0f}) items={len(d['items'])} type={d['type']}")
print("total in region:", n)
doc.close()
