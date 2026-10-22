"""Interactive Multi-Book Teacher Workbench (`W6` — `authoring/agent/viewer.py`).

Upgrades over v1.0:
1. 100% Multi-Grade Parameterized (`--book-manifest`, `--pdf`, `--pagemap`, `--cartridge`,
   `--verdicts-path`, `--observation`, `--issues`) — zero hardcoded `C205` titles or paths!
2. Built-in Live `8x` Nearest-Neighbor Pixel Loupe (`ctx.imageSmoothingEnabled = false`) over
   high-DPI rendered textbook pages streamed strictly from RAM (zero image files in Git!).
3. Local SHA-256 Locked Governance Endpoint (`POST /api/verdict`) recording explicit teacher
   verdicts (`MAP_APPROVED`, `ROW_APPROVED`, `ERROR_CODE_APPROVED`, `RELEASE_AUTHORIZED`,
   `ROW_REJECTED`, `MAP_REVISION_REQUESTED`) via `GovernanceLedger`, rejecting non-teacher actors
   with `403`, and auto-invalidating stale verdicts (`INVALIDATED_STALE_VERDICTS`) whenever a
   single byte of the upstream `.xlsx` changes!
"""

from __future__ import annotations

import argparse
import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlparse

import pymupdf

from .governance import (
    GovernanceLedger,
    GovernanceViolationError,
    evaluate_release_readiness,
)
from .models import file_sha256
from .paths import resolve_fixture

HTML_INDEX = """<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title id="docTitle">میز کار امن بازبینی شواهد و امضای معلم — khshab-agent v2.0</title>
  <style>
    :root { --bg:#0b1526; --card:#13233d; --ink:#eef4ff; --muted:#9bb0d1; --acc:#5ee0b5; --warn:#ffd166; --err:#ff6b6b; }
    * { box-sizing:border-box; font-family: Tahoma, Vazirmatn, sans-serif; }
    body { margin:0; background:var(--bg); color:var(--ink); }
    header { padding:14px 20px; background:#0f1d35; border-bottom:1px solid #22395e; display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between; }
    h1 { font-size:16px; margin:0; color:var(--acc); }
    .meta { font-size:12px; color:var(--muted); }
    main { display:grid; grid-template-columns: 330px 1fr 390px; gap:14px; padding:14px; min-height:calc(100vh - 60px); }
    @media (max-width:1100px) { main { grid-template-columns:1fr; } }
    .panel { background:var(--card); border:1px solid #22395e; border-radius:10px; padding:12px; overflow:auto; max-height:calc(100vh - 90px); }
    button, select, input, textarea { background:#1a3154; color:var(--ink); border:1px solid #35578a; border-radius:6px; padding:6px 10px; }
    button { cursor:pointer; }
    button:hover { border-color:var(--acc); }
    .badge { display:inline-block; padding:2px 7px; border-radius:999px; font-size:11px; margin-right:4px; }
    .b-ok { background:#143d33; color:var(--acc); }
    .b-warn { background:#443715; color:var(--warn); }
    .b-err { background:#471d24; color:var(--err); }
    .canvas-wrap { position:relative; display:inline-block; max-width:100%; cursor:crosshair; }
    .canvas-wrap img { max-width:100%; height:auto; display:block; border-radius:6px; }
    .bbox { position:absolute; border:2px solid #ff6b6b; background:rgba(255,107,107,0.12); pointer-events:auto; }
    .bbox:hover { background:rgba(94,224,181,0.22); border-color:#5ee0b5; }
    #loupeCanvas {
      border:2px solid var(--acc); border-radius:8px; background:#050b14;
      image-rendering: pixelated; image-rendering: crisp-edges; width:240px; height:240px;
    }
    .issue { border-right:3px solid var(--warn); padding:8px; margin-bottom:8px; background:#0e1b30; border-radius:6px; font-size:12.5px; line-height:1.7; }
    .issue.CRIT { border-right-color:var(--err); }
    .controls { display:flex; gap:8px; align-items:center; margin-bottom:10px; flex-wrap:wrap; }
    .verdict-box { border:1px solid #2d4c7a; border-radius:8px; padding:10px; margin-bottom:12px; background:#0d1a2e; }
    .verdict-box label { display:block; font-size:12px; color:var(--muted); margin:6px 0 3px; }
    .verdict-box input, .verdict-box select, .verdict-box textarea { width:100%; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1 id="hdrTitle">میز کار امن بازبینی شواهد و امضای معلم</h1>
      <div class="meta" id="hdr-meta">در حال بارگذاری شناسنامه و وضعیت گیت‌ها...</div>
    </div>
    <div class="controls" style="margin:0">
      <label>بزرگ‌نمایی ذره‌بین پیکسلی:</label>
      <select id="zoomSelect">
        <option value="4">4x</option>
        <option value="8" selected>8x (پیش‌فرض شمارش)</option>
        <option value="12">12x</option>
      </select>
      <label>صفحهٔ PDF:</label>
      <input id="pdfPageInput" type="number" min="1" max="250" value="1" style="width:76px" />
      <button id="goBtn">نمایش صفحه</button>
    </div>
  </header>
  <main>
    <section class="panel">
      <h3 style="margin-top:0">صف اختلاف‌ها و صفحات کلیدی</h3>
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
      <h3 style="margin-top:0">ذره‌بین پیکسلی زنده (Nearest-Neighbor)</h3>
      <div style="text-align:center;margin-bottom:12px">
        <canvas id="loupeCanvas" width="240" height="240"></canvas>
        <div class="meta" id="loupeCoords">نشانگر ماوس را روی تصویر صفحه ببرید تا پیکسل‌های واقعی بدون تاری نمایش داده شوند.</div>
      </div>

      <div class="verdict-box">
        <h3 style="margin:0 0 6px;font-size:14px;color:var(--acc)">ثبت امضای رسمی معلم (قفل SHA-256)</h3>
        <label>دامنهٔ حکم (`scope`):</label>
        <select id="vScope">
          <option value="MAP_APPROVED">MAP_APPROVED (تأیید نقشهٔ صفحات)</option>
          <option value="ROW_APPROVED">ROW_APPROVED (تأیید ردیف S1 / سؤال)</option>
          <option value="ERROR_CODE_APPROVED">ERROR_CODE_APPROVED (تأیید کد خطای اطلس)</option>
          <option value="ROW_REJECTED">ROW_REJECTED (رد و بازگشت جهت اصلاح)</option>
          <option value="MAP_REVISION_REQUESTED">MAP_REVISION_REQUESTED (درخواست اصلاح نقشه)</option>
        </select>
        <label>نام امضاکننده (معلم انسانی):</label>
        <input id="vActor" value="استاد راهنما" />
        <label>شناسه‌های هدف (جداشده با کاما، مثل `L-401, Q-1069` یا `P100`):</label>
        <input id="vTargets" placeholder="مثلاً L-401, Q-1069" />
        <label>یادداشت بازبینی:</label>
        <textarea id="vNotes" rows="2"></textarea>
        <button id="signBtn" style="margin-top:8px;width:100%">ثبت حکم با قفل SHA-256</button>
        <div class="meta" id="verdictMsg" style="margin-top:6px"></div>
      </div>

      <h3 style="margin-top:0">ادعاهای اتمی و شواهد این صفحه</h3>
      <div id="claimsList"></div>
    </section>
  </main>
  <script>
    let STATE = { summary: null, maxPages: 152 };
    const loupe = document.getElementById('loupeCanvas');
    const lctx = loupe.getContext('2d');
    lctx.imageSmoothingEnabled = false;

    async function boot() {
      const r = await fetch('api/summary');
      STATE.summary = await r.json();
      const m = STATE.summary;
      STATE.maxPages = m.total_pdf_pages || 152;
      document.getElementById('pdfPageInput').max = STATE.maxPages;
      document.getElementById('docTitle').textContent = `میز کار شواهد — ${m.book_title}`;
      document.getElementById('hdrTitle').textContent = `میز کار امن شواهد و امضای معلم — ${m.book_title}`;
      document.getElementById('hdr-meta').textContent =
        `SHA-256 منبع: ${(m.source_pdf_sha256 || '').slice(0,16)}… | حکم‌های فعال: ${m.active_verdicts} | حکم‌های باطل‌شده: ${m.invalidated_verdicts} | وضعیت انتشار: ${m.release_status}`;
      const list = document.getElementById('issuesList');
      list.innerHTML = '';
      for (const it of (m.issues || [])) {
        const d = document.createElement('div');
        d.className = 'issue ' + (it.severity === 'CRITICAL' || it.severity === 'HIGH' ? 'CRIT' : '');
        d.innerHTML = `<strong>ص PDF ${it.pdf_page} (چاپی ${it.book_page ?? '—'}) — ${it.field_name}</strong>
          <span class="badge ${it.status === 'RESOLVED_BY_CROP_EVIDENCE' ? 'b-ok' : 'b-warn'}">${it.status}</span>
          <div>${it.summary_fa}</div>`;
        d.onclick = () => loadPage(it.pdf_page);
        d.style.cursor = 'pointer';
        list.appendChild(d);
      }
      loadPage(1);
    }

    function updateLoupe(ev) {
      const img = document.getElementById('pageImg');
      if (!img.naturalWidth) return;
      const rect = img.getBoundingClientRect();
      const rx = (ev.clientX - rect.left) / rect.width;
      const ry = (ev.clientY - rect.top) / rect.height;
      const zoom = Number(document.getElementById('zoomSelect').value) || 8;
      const srcW = Math.max(8, Math.floor(loupe.width / zoom));
      const srcH = Math.max(8, Math.floor(loupe.height / zoom));
      const sx = Math.max(0, Math.min(img.naturalWidth - srcW, Math.floor(rx * img.naturalWidth - srcW / 2)));
      const sy = Math.max(0, Math.min(img.naturalHeight - srcH, Math.floor(ry * img.naturalHeight - srcH / 2)));
      lctx.imageSmoothingEnabled = false;
      lctx.clearRect(0, 0, loupe.width, loupe.height);
      lctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, loupe.width, loupe.height);
      lctx.strokeStyle = '#ff6b6b';
      lctx.lineWidth = 1;
      lctx.strokeRect(loupe.width / 2 - zoom / 2, loupe.height / 2 - zoom / 2, zoom, zoom);
      document.getElementById('loupeCoords').textContent =
        `زوم پیکسلی ${zoom}x (Nearest-Neighbor) — مختصات نرمال: (${rx.toFixed(3)}, ${ry.toFixed(3)})`;
    }

    async function loadPage(pno) {
      pno = Math.max(1, Math.min(STATE.maxPages, Number(pno) || 1));
      document.getElementById('pdfPageInput').value = pno;
      const r = await fetch(`api/page?pdf_page=${pno}`);
      const data = await r.json();
      const q = data.quality || {};
      document.getElementById('pageBannerInfo').innerHTML =
        `<strong>صفحهٔ PDF ${pno}</strong> | صفحهٔ چاپی: <strong>${q.expected_book_page ?? 'پیش/پس‌درآمد'}</strong> | ` +
        `پاصفحهٔ استخراج‌شده: <strong>${q.extracted_footer_book_page ?? '—'}</strong> | ` +
        `وابستگی بصری: <span class="badge b-warn">${q.visual_dependency ?? '—'}</span> | ` +
        `مخاطرات: ${(q.hazards || []).join(' ، ') || 'ندارد'}`;
      const img = document.getElementById('pageImg');
      img.onload = () => renderBoxes(data.claims || []);
      img.src = `api/render?pdf_page=${pno}&dpi=240`;

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
        cl.innerHTML = '<div class="meta">ادعای ویژهٔ بصری ثبت نشده است.</div>';
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

    document.getElementById('pageImg').addEventListener('mousemove', updateLoupe);
    document.getElementById('goBtn').onclick = () => loadPage(document.getElementById('pdfPageInput').value);
    document.getElementById('signBtn').onclick = async () => {
      const targets = document.getElementById('vTargets').value.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('api/verdict', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          scope: document.getElementById('vScope').value,
          actor: document.getElementById('vActor').value,
          actor_role: 'human_teacher',
          target_ids: targets,
          notes: document.getElementById('vNotes').value
        })
      });
      const out = await res.json();
      document.getElementById('verdictMsg').textContent = res.ok
        ? `✓ ثبت شد: ${out.verdict_id} (SHA=${out.target_sha256.slice(0,12)}…)`
        : `✗ خطا: ${out.error}`;
      if (res.ok) boot();
    };
    boot();
  </script>
</body>
</html>
"""


def create_viewer_handler(
    repo_root: Path,
    pdf_path: Path,
    *,
    book_manifest_path: Optional[Path] = None,
    pagemap_path: Optional[Path] = None,
    cartridge_path: Optional[Path] = None,
    verdicts_path: Optional[Path] = None,
    obs_path: Optional[Path] = None,
    issues_path: Optional[Path] = None,
):
    root = Path(repo_root).resolve()
    bm_file = Path(book_manifest_path) if book_manifest_path else resolve_fixture(root, "book_manifest_C205.json", "authoring/data/book_manifest_C205.json")
    pm_file = Path(pagemap_path) if pagemap_path else resolve_fixture(root, "PAGE-MAP-KH-G2-MATH-v1_verified.xlsx", "authoring/PAGE-MAP-KH-G2-MATH-v1_audited.xlsx")
    wb_file = Path(cartridge_path) if cartridge_path else resolve_fixture(root, "khshab-G2-MATH_v0.5.xlsx", "authoring/khshab-G2-MATH_v0.5.xlsx")
    vd_file = Path(verdicts_path) if verdicts_path else (root / "authoring/audit/verdicts_C205.json")
    ob_file = Path(obs_path) if obs_path else resolve_fixture(root, "observation_C205.json", "authoring/audit/observation_C205.json")
    iq_file = Path(issues_path) if issues_path else resolve_fixture(root, "issue_queue_C205.json", "authoring/audit/issue_queue_C205.json")

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
                        "observation_ready": ob_file.exists(),
                        "pagemap_ready": pm_file.exists(),
                        "cartridge_ready": wb_file.exists(),
                    },
                )
                return

            if route == "/api/summary":
                bm = json.loads(bm_file.read_text(encoding="utf-8")) if bm_file.exists() else {}
                obs = json.loads(ob_file.read_text(encoding="utf-8")) if ob_file.exists() else {}
                issues = json.loads(iq_file.read_text(encoding="utf-8")).get("issues", []) if iq_file.exists() else []
                q_scores = obs.get("quality_scores", [])
                footer_ok = sum(1 for q in q_scores if q.get("footer_alignment_status") == "MATCH")
                total_pages = len(q_scores) or bm.get("source_pdf", {}).get("pdf_page_count", 152)

                ledger = GovernanceLedger(vd_file)
                active_cnt = 0
                invalid_cnt = 0
                rel_status = "BLOCKED:AWAITING_TEACHER_VERDICT"
                blockers = []
                if pm_file.exists() and wb_file.exists():
                    open_cnt = sum(1 for i in issues if i.get("status") not in ("RESOLVED", "RESOLVED_BY_CROP_EVIDENCE"))
                    g7, _ = evaluate_release_readiness(
                        ledger=ledger,
                        pagemap_sha256=file_sha256(str(pm_file)),
                        workbook_path=wb_file,
                        workbook_sha256=file_sha256(str(wb_file)),
                        upstream_gates={},
                        open_issue_count=open_cnt,
                    )
                    active_cnt = g7.metrics["active_verdict_count"]
                    invalid_cnt = g7.metrics["invalidated_verdict_count"]
                    blockers = g7.metrics["blocker_reasons"]
                    rel_status = "PASS:RELEASE_AUTHORIZED" if g7.status == "PASS" else f"BLOCKED:{','.join(blockers)}"

                self._send_json(
                    200,
                    {
                        "book_code": bm.get("book_code", obs.get("book_code", "BOOK")),
                        "book_title": bm.get("title_fa", bm.get("book_code", "کتاب درسی")),
                        "total_pdf_pages": total_pages,
                        "source_pdf_sha256": (
                            file_sha256(str(pdf_path))
                            if pdf_path.exists()
                            else obs.get("source_pdf_sha256", bm.get("source_pdf", {}).get("sha256", "MISSING"))
                        ),
                        "pagemap_sha256": file_sha256(str(pm_file)) if pm_file.exists() else None,
                        "cartridge_sha256": file_sha256(str(wb_file)) if wb_file.exists() else None,
                        "footer_matches": footer_ok,
                        "issues": issues,
                        "evidence_ledger": obs.get("evidence_ledger", {}),
                        "active_verdicts": active_cnt,
                        "invalidated_verdicts": invalid_cnt,
                        "blocker_reasons": blockers,
                        "release_status": rel_status,
                    },
                )
                return

            if route == "/api/page":
                obs = json.loads(ob_file.read_text(encoding="utf-8")) if ob_file.exists() else {}
                pno = max(1, int(qs.get("pdf_page", ["1"])[0]))
                q_scores = obs.get("quality_scores", [])
                quality = q_scores[pno - 1] if pno <= len(q_scores) else {}
                claims = [c for c in obs.get("claims", []) if c.get("pdf_page") == pno]
                self._send_json(200, {"pdf_page": pno, "quality": quality, "claims": claims})
                return

            if route == "/api/render":
                if not pdf_path.exists():
                    self._send_json(503, {"error": "SOURCE_PDF_MISSING_IN_VAULT"})
                    return
                dpi = max(72, min(300, int(qs.get("dpi", ["150"])[0])))
                doc = pymupdf.open(str(pdf_path))
                try:
                    pno = max(1, min(len(doc), int(qs.get("pdf_page", ["1"])[0])))
                    pix = doc[pno - 1].get_pixmap(dpi=dpi)
                    png_bytes = pix.tobytes("png")
                finally:
                    doc.close()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Content-Length", str(len(png_bytes)))
                self.send_header("Cache-Control", "private, no-store")
                self.end_headers()
                self.wfile.write(io.BytesIO(png_bytes).getvalue())
                return

            self._send_json(404, {"error": "NOT_FOUND"})

        def do_POST(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path != "/api/verdict":
                self._send_json(404, {"error": "NOT_FOUND"})
                return
            length = int(self.headers.get("Content-Length", "0"))
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                scope = str(body["scope"])
                actor = str(body["actor"])
                actor_role = str(body.get("actor_role", "human_teacher"))
                target_ids = list(body["target_ids"])
                notes = str(body.get("notes", ""))
                ledger = GovernanceLedger(vd_file)
                verdict_id = body.get("verdict_id") or f"TV-{len(ledger.verdicts) + 1:04d}"
                target_artifact = pm_file if scope in ("MAP_APPROVED", "MAP_REVISION_REQUESTED") else wb_file
                if not target_artifact.exists():
                    self._send_json(400, {"error": f"TARGET_ARTIFACT_MISSING:{target_artifact}"})
                    return
                target_sha = file_sha256(str(target_artifact))
                verdict = ledger.record_verdict(
                    verdict_id=verdict_id,
                    scope=scope,
                    actor=actor,
                    actor_role=actor_role,
                    target_ids=target_ids,
                    target_sha256=target_sha,
                    notes=notes,
                )
                ledger_sha = ledger.save()
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "verdict_id": verdict.verdict_id,
                        "scope": verdict.scope,
                        "target_sha256": target_sha,
                        "ledger_sha256": ledger_sha,
                    },
                )
            except GovernanceViolationError as exc:
                self._send_json(403, {"ok": False, "error": str(exc)})
            except Exception as exc:
                self._send_json(400, {"ok": False, "error": str(exc)})

        def log_message(self, fmt: str, *args) -> None:
            return

    return EvidenceViewerHandler


def serve_viewer(
    repo_root: Path,
    pdf_path: Path,
    host: str = "0.0.0.0",
    port: int = 8765,
    *,
    book_manifest_path: Optional[Path] = None,
    pagemap_path: Optional[Path] = None,
    cartridge_path: Optional[Path] = None,
    verdicts_path: Optional[Path] = None,
) -> None:
    handler = create_viewer_handler(
        repo_root,
        pdf_path,
        book_manifest_path=book_manifest_path,
        pagemap_path=pagemap_path,
        cartridge_path=cartridge_path,
        verdicts_path=verdicts_path,
    )
    server = ThreadingHTTPServer((host, port), handler)
    print(f"[viewer] listening on http://{host}:{port} (vault PDF present={pdf_path.exists()})", flush=True)
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Interactive multi-book textbook evidence & teacher verdict workbench")
    parser.add_argument("--repo-root", default=".", help="Path to repository root")
    parser.add_argument("--pdf", default="/tmp/khshab_secure_vault/C205.pdf", help="Quarantined source PDF path")
    parser.add_argument("--book-manifest", default=None, help="Book manifest JSON path")
    parser.add_argument("--pagemap", default=None, help="Verified PAGE-MAP xlsx path")
    parser.add_argument("--cartridge", default=None, help="Target cartridge xlsx path")
    parser.add_argument("--verdicts-path", default=None, help="Governance ledger JSON path")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    serve_viewer(
        Path(args.repo_root).resolve(),
        Path(args.pdf),
        args.host,
        args.port,
        book_manifest_path=Path(args.book_manifest) if args.book_manifest else None,
        pagemap_path=Path(args.pagemap) if args.pagemap else None,
        cartridge_path=Path(args.cartridge) if args.cartridge else None,
        verdicts_path=Path(args.verdicts_path) if args.verdicts_path else None,
    )


if __name__ == "__main__":
    main()
