import fitz, sys
doc = fitz.open("/home/z/my-project/upload/C205.pdf")
mode = sys.argv[1]
pages = [int(x) for x in sys.argv[2].split(",")]
for pno1 in pages:
    page = doc[pno1-1]
    print(f"\n===== PDF page {pno1} (book {pno1-6}) =====")
    if mode == "words":
        for w in sorted(page.get_text("words"), key=lambda w:(round(w[1]/4), -w[0])):
            if len(sys.argv) > 3:
                lo, hi = float(sys.argv[3]), float(sys.argv[4])
                if not (lo <= w[1] <= hi): continue
            print(f"  y={w[1]:.0f} x={w[0]:.0f} | {w[4]}")
    elif mode == "img":
        for info in page.get_image_info():
            b = info["bbox"]
            print(f"  image bbox=({b[0]:.0f},{b[1]:.0f})-({b[2]:.0f},{b[3]:.0f}) size={info['width']}x{info['height']}")
doc.close()
