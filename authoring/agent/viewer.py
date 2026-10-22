"""Safe Read-Only Local Evidence Viewer (`authoring/agent/viewer.py`).

Binds strictly to `0.0.0.0:<port>` for preview compatibility, accepts any preview
host/origin without CORS/Host blocking, never embeds `localhost` URLs in browser code
(uses strictly relative paths `/api/...`), and streams on-demand PNG renders directly
from `/tmp/c205_secure_vault/C205.pdf` in RAM so ZERO copyrighted images ever touch Git!
"""

from __future__ import annotations

import argparse
import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pymupdf


HTML_INDEX = """<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>نمایشگر امن شواهد کتاب درسی — C205 (چاپ چهاردهم ۱۴۰۴)</title>
  <style>
    :root { --bg:#0b1526; --card:#13233d; --ink:#eef4ff; --muted:#9bb0d1; --acc:#5ee0b5; --warn:#ffd166; --err:#ff6b6b; }
    * { box-sizing:border-box; font-family: Tahoma, Vazirmatn, sans-serif; }
    body { margin:0; background:var(--bg); color:var(--ink); }
    header { padding:14px 20px; background:#0f1d35; border-bottom:1px solid #22395e; display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between; }
    h1 { font-size:16px; margin:0; color:var(--acc); }
    .meta { font-size:12px; color:var(--muted); }
    main { display:grid; grid-template-columns: 340px 1fr 380px; gap:14px; padding:14px; min-height:calc(100vh - 60px); }
    @media (max-width:1100px) { main { grid-template-columns:1fr; } }
    .panel { background:var(--card); border:1px solid #22395e; border-radius:10px; padding:12px; overflow:auto; max-height:calc(100vh - 90px); }
    button, select, input { background:#1a3154; color:var(--ink); border:1px solid #35578a; border-radius:6px; padding:6px 10px; cursor:pointer; }
    button:hover { border-color:var(--acc); }
    .badge { display:inline-block; padding:2px 7px; border-radius:999px; font-size:11px; margin-right:4px; }
    .b-ok { background:#143d33; color:var(--acc); }
    .b-warn { background:#443715; color:var(--warn); }
    .b-err { background:#471d24; color:var(--err); }
    .canvas-wrap { position:relative; display:inline-block; max-width:100%; }
    .canvas-wrap img { max-width:100%; height:auto; display:block; border-radius:6px; }
    .bbox { position:absolute; border:2px solid #ff6b6b; background:rgba(255,107,107,0.12); pointer-events:auto; }
    .bbox:hover { background:rgba(94,224,181,0.22); border-color:#5ee0b5; }
    .issue { border-right:3px solid var(--warn); padding:8px; margin-bottom:8px; background:#0e1b30; border-radius:6px; font-size:12.5px; line-height:1.7; }
    .issue.CRIT { border-right-color:var(--err); }
    .controls { display:flex; gap:8px; align-items:center; margin-bottom:10px; flex-wrap:wrap; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>نمایشگر امن شواهد ناحیه‌ای و صف اختلاف‌ها — ریاضی دوم (کد ۲۰۵، چاپ چهاردهم ۱۴۰۴)</h1>
      <div class="meta" id="hdr-meta">در حال بارگذاری شناسنامه و وضعیت گیت‌ها...</div>
    </div>
    <div class="controls" style="margin:0">
      <label>صفحهٔ PDF:</label>
      <input id="pdfPageInput" type="number" min="1" max="152" value="40" style="width:76px" />
      <button id="goBtn">نمایش صفحه</button>
    </div>
  </header>
  <main>
    <section class="panel">
      <h3 style="margin-top:0">صف اختلاف‌ها و صفحات طلایی</h3>
      <div id="issuesList"></div>
    </section>
    <section class="panel" style="text-align:center">
      <div id="pageBannerInfo" style="margin-bottom:8px;text-align:right;font-size:13px"></div>
      <div class="canvas-wrap" id="imgStage">
        <img id="pageImg" alt="نمای صفحه از قرنطینه" />
        <div id="overlayLayer"></div>
      </div>
    </section>
    <section class="panel">
      <h3 style="margin-top:0">ادعاهای اتمی و شواهد این صفحه</h3>
      <div id="claimsList"></div>
    </section>
  </main>
  <script>
    let STATE = { summary: null };
    async function boot() {
      const r = await fetch('api/summary');
      STATE.summary = await r.json();
      const m = STATE.summary;
      document.getElementById('hdr-meta').textContent =
        `SHA-256 منبع: ${m.source_pdf_sha256.slice(0,16)}… | تطابق پاصفحه: ${m.footer_matches}/144 | اختلاف‌های کشف‌شده: ${m.issues.length} | وضعیت انتشار خشاب: ${m.release_status}`;
      const list = document.getElementById('issuesList');
      list.innerHTML = '';
      for (const it of m.issues) {
        const d = document.createElement('div');
        d.className = 'issue ' + (it.severity === 'CRITICAL' || it.severity === 'HIGH' ? 'CRIT' : '');
        d.innerHTML = `<strong>ص PDF ${it.pdf_page} (چاپی ${it.book_page ?? 'پیش'}) — ${it.field_name}</strong>
          <span class="badge ${it.status === 'RESOLVED_BY_CROP_EVIDENCE' ? 'b-ok' : 'b-warn'}">${it.status}</span>
          <div>${it.summary_fa}</div>`;
        d.onclick = () => loadPage(it.pdf_page);
        d.style.cursor = 'pointer';
        list.appendChild(d);
      }
      loadPage(40);
    }
    async function loadPage(pno) {
      pno = Math.max(1, Math.min(152, Number(pno) || 1));
      document.getElementById('pdfPageInput').value = pno;
      const r = await fetch(`api/page?pdf_page=${pno}`);
      const data = await r.json();
      document.getElementById('pageBannerInfo').innerHTML =
        `<strong>صفحهٔ PDF ${pno}</strong> | صفحهٔ چاپی مورد انتظار: <strong>${data.quality.expected_book_page ?? 'پیش/پس‌درآمد'}</strong> | ` +
        `پاصفحهٔ استخراج‌شده: <strong>${data.quality.extracted_footer_book_page ?? '—'}</strong> | ` +
        `وابستگی بصری: <span class="badge b-warn">${data.quality.visual_dependency}</span> | ` +
        `مخاطرات: ${(data.quality.hazards || []).join(' ، ') || 'ندارد'}`;
      const img = document.getElementById('pageImg');
      img.onload = () => renderBoxes(data.claims || []);
      img.src = `api/render?pdf_page=${pno}`;

      const cl = document.getElementById('claimsList');
      cl.innerHTML = '';
      for (const c of (data.claims || [])) {
        const div = document.createElement('div');
        div.className = 'issue';
        div.innerHTML = `<strong>${c.field_name}</strong> <span class="badge b-ok">${c.confidence}</span>` +
          `<div>خوانش خام: ${c.raw_reading}</div>` +
          `<div style="color:#9bb0d1">نقش/واحد: ${c.unit_or_role} | شاهد: ${(c.evidence_refs||[]).join(', ')}</div>`;
        cl.appendChild(div);
      }
      if (!(data.claims || []).length) {
        cl.innerHTML = '<div class="meta">ادعای ویژهٔ بصری برای این صفحه ثبت نشده؛ لایهٔ متنی و پاصفحه بررسی شده است.</div>';
      }
    }
    function renderBoxes(claims) {
      const layer = document.getElementById('overlayLayer');
      layer.innerHTML = '';
      const ledger = (STATE.summary && STATE.summary.evidence_ledger) || {};
      for (const c of claims) {
        for (const eid of (c.evidence_refs || [])) {
          const ev = ledger[eid];
          if (!ev || !ev.bbox_normalized) continue;
          const [x0, y0, x1, y1] = ev.bbox_normalized;
          const box = document.createElement('div');
          box.className = 'bbox';
          box.style.left = (x0 * 100) + '%';
          box.style.top = (y0 * 100) + '%';
          box.style.width = ((x1 - x0) * 100) + '%';
          box.style.height = ((y1 - y0) * 100) + '%';
          box.title = `${c.field_name}: ${c.raw_reading}`;
          layer.appendChild(box);
        }
      }
    }
    document.getElementById('goBtn').onclick = () => loadPage(document.getElementById('pdfPageInput').value);
    boot();
  </script>
</body>
</html>
"""


def create_viewer_handler(repo_root: Path, pdf_path: Path):
    obs_path = repo_root / "authoring/audit/observation_C205.json"
    issues_path = repo_root / "authoring/audit/issue_queue_C205.json"
    gov_path = repo_root / "authoring/waves/wave_manifest_v0.5.json"

    class EvidenceViewerHandler(BaseHTTPRequestHandler):
        def _send_json(self, code: int, obj: dict) -> None:
            raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            route = parsed.path
            qs = parse_qs(parsed.query)

            if route in ("/", "/index.html"):
                body = HTML_INDEX.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            if route == "/api/health":
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "pdf_available_in_vault": pdf_path.exists(),
                        "observation_ready": obs_path.exists(),
                    },
                )
                return

            if route == "/api/summary":
                obs = json.loads(obs_path.read_text(encoding="utf-8")) if obs_path.exists() else {}
                issues = json.loads(issues_path.read_text(encoding="utf-8")).get("issues", []) if issues_path.exists() else []
                wave = json.loads(gov_path.read_text(encoding="utf-8")) if gov_path.exists() else {}
                q_scores = obs.get("quality_scores", [])
                footer_ok = sum(1 for q in q_scores if q.get("footer_alignment_status") == "MATCH")
                self._send_json(
                    200,
                    {
                        "source_pdf_sha256": obs.get("source_pdf_sha256", "MISSING"),
                        "footer_matches": footer_ok,
                        "issues": issues,
                        "evidence_ledger": obs.get("evidence_ledger", {}),
                        "release_status": wave.get("release_status", "BLOCKED:AWAITING_TEACHER_VERDICT"),
                    },
                )
                return

            if route == "/api/page":
                obs = json.loads(obs_path.read_text(encoding="utf-8")) if obs_path.exists() else {}
                pno = max(1, min(152, int(qs.get("pdf_page", ["1"])[0])))
                q_scores = obs.get("quality_scores", [])
                quality = q_scores[pno - 1] if pno <= len(q_scores) else {}
                claims = [c for c in obs.get("claims", []) if c.get("pdf_page") == pno]
                self._send_json(200, {"pdf_page": pno, "quality": quality, "claims": claims})
                return

            if route == "/api/render":
                if not pdf_path.exists():
                    self._send_json(503, {"error": "SOURCE_PDF_MISSING_IN_VAULT"})
                    return
                pno = max(1, min(152, int(qs.get("pdf_page", ["1"])[0])))
                doc = pymupdf.open(str(pdf_path))
                pix = doc[pno - 1].get_pixmap(dpi=120)
                png_bytes = pix.tobytes("png")
                doc.close()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(png_bytes)))
                self.send_header("Cache-Control", "private, no-store")
                self.end_headers()
                self.wfile.write(io.BytesIO(png_bytes).getvalue())
                return

            self._send_json(404, {"error": "NOT_FOUND"})

        def log_message(self, fmt: str, *args) -> None:
            return

    return EvidenceViewerHandler


def serve_viewer(repo_root: Path, pdf_path: Path, host: str = "0.0.0.0", port: int = 8765) -> None:
    handler = create_viewer_handler(repo_root, pdf_path)
    server = ThreadingHTTPServer((host, port), handler)
    print(f"[viewer] listening on http://{host}:{port} (vault PDF present={pdf_path.exists()})", flush=True)
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Safe local read-only textbook evidence viewer")
    parser.add_argument("--repo-root", default=".", help="Path to repository root")
    parser.add_argument("--pdf", default="/tmp/c205_secure_vault/C205.pdf", help="Quarantined source PDF path")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    serve_viewer(Path(args.repo_root).resolve(), Path(args.pdf), args.host, args.port)


if __name__ == "__main__":
    main()
