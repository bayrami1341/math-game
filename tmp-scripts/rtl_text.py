import fitz, sys
doc = fitz.open("/home/z/my-project/upload/C205.pdf")
start, end = int(sys.argv[1]), int(sys.argv[2])
for pno in range(start-1, end):
    page = doc[pno]
    words = page.get_text("words")  # x0,y0,x1,y1,word,block,line,word_no
    lines = {}
    for w in words:
        x0,y0,x1,y1,t = w[0],w[1],w[2],w[3],w[4]
        key = round(y0/6)  # 6px bands
        lines.setdefault(key, []).append((x0,y0,t))
    print(f"\n===== PDF page {pno+1} (book {pno+1-6}) =====")
    for key in sorted(lines):
        ws = sorted(lines[key], key=lambda a: -a[0])  # right to left
        y = min(a[1] for a in ws)
        txt = " ".join(a[2] for a in ws)
        print(f"y~{int(y):3d} | {txt}")
doc.close()
