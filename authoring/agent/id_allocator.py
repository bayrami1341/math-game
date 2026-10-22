"""Immutable, non-recyclable ID Registry & Deterministic Allocator (`L-`, `Q-`, `E_`).

Enforces:
1. Uniqueness across all active and historical workbook versions (`v0.1` .. `v0.5`).
2. Permanence: once allocated, an ID maps to a single `semantic_key` forever; re-running
   allocation for the same `semantic_key` returns the exact same ID (idempotent).
3. Non-recycling: retiring an ID moves it to `retired_ids`; attempting to assign a retired
   or colliding ID to any new entity raises `ImmutableIDViolationError`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, Iterable, Optional

import openpyxl


class ImmutableIDViolationError(RuntimeError):
    """Raised when an ID collision, mutation, or recycling of a retired ID is attempted."""


def normalize_error_code(raw: str) -> str:
    m = re.match(r"^\s*(E_[A-Z0-9_]+)", str(raw or ""))
    return m.group(1) if m else str(raw or "").strip()


class IDAllocator:
    def __init__(self, registry_data: Optional[dict] = None) -> None:
        base = registry_data or {}
        self.schema_version = "1.0.0"
        # namespace ("L" | "Q" | "E") -> id_str -> semantic_key
        self.allocated: Dict[str, Dict[str, str]] = {
            ns: dict(base.get("allocated", {}).get(ns, {})) for ns in ("L", "Q", "E")
        }
        # namespace -> semantic_key -> id_str
        self.by_key: Dict[str, Dict[str, str]] = {
            ns: {v: k for k, v in self.allocated[ns].items()} for ns in ("L", "Q", "E")
        }
        self.retired: Dict[str, Dict[str, str]] = {
            ns: dict(base.get("retired", {}).get(ns, {})) for ns in ("L", "Q", "E")
        }

    @classmethod
    def from_existing_workbooks(cls, workbook_paths: Iterable[str | Path], runtime_error_codes: Iterable[str] = ()) -> "IDAllocator":
        alloc = cls()
        for code in runtime_error_codes:
            clean = normalize_error_code(code)
            if clean:
                alloc.register_existing("E", clean, f"runtime:{clean}")

        for wb_path in workbook_paths:
            p = Path(wb_path)
            if not p.exists():
                continue
            wb = openpyxl.load_workbook(p, data_only=True)
            if "نقشهٔ کتاب (S1)" in wb.sheetnames:
                ws = wb["نقشهٔ کتاب (S1)"]
                for r in range(3, ws.max_row + 1):
                    lid = ws.cell(r, 1).value
                    if lid == "یادداشت" or not lid:
                        break
                    lid_s = str(lid).strip()
                    page_s = str(ws.cell(r, 2).value or "").strip()
                    ch_s = str(ws.cell(r, 3).value or "").strip()
                    key = f"s1:ch={ch_s}:page={page_s}:id={lid_s}"
                    if lid_s not in alloc.allocated["L"]:
                        alloc.register_existing("L", lid_s, key)

            if "اطلس خطا" in wb.sheetnames:
                ws = wb["اطلس خطا"]
                for r in range(4, ws.max_row + 1):
                    eid = ws.cell(r, 1).value
                    if eid == "یادداشت" or not eid:
                        break
                    clean = normalize_error_code(str(eid))
                    if clean and clean not in alloc.allocated["E"]:
                        alloc.register_existing("E", clean, f"atlas:{clean}")

            if "بانک سؤال" in wb.sheetnames:
                ws = wb["بانک سؤال"]
                for r in range(4, ws.max_row + 1):
                    qid = ws.cell(r, 1).value
                    if qid == "یادداشت" or not qid:
                        break
                    qid_s = str(qid).strip()
                    anchor = str(ws.cell(r, 2).value or "").strip()
                    if qid_s not in alloc.allocated["Q"]:
                        alloc.register_existing("Q", qid_s, f"bank:{anchor}:{qid_s}")
        return alloc

    def register_existing(self, ns: str, entity_id: str, semantic_key: str) -> str:
        if entity_id in self.retired[ns]:
            raise ImmutableIDViolationError(f"Cannot register retired {ns}-ID `{entity_id}` for `{semantic_key}`.")
        if entity_id in self.allocated[ns] and self.allocated[ns][entity_id] != semantic_key:
            raise ImmutableIDViolationError(
                f"ID collision in namespace `{ns}`: `{entity_id}` already bound to `{self.allocated[ns][entity_id]}`, got `{semantic_key}`."
            )
        self.allocated[ns][entity_id] = semantic_key
        self.by_key[ns][semantic_key] = entity_id
        return entity_id

    def retire(self, ns: str, entity_id: str, reason: str) -> None:
        if entity_id not in self.allocated[ns]:
            raise ImmutableIDViolationError(f"Cannot retire unknown {ns}-ID `{entity_id}`.")
        prev_key = self.allocated[ns].pop(entity_id)
        self.by_key[ns].pop(prev_key, None)
        self.retired[ns][entity_id] = f"{prev_key} | retired:{reason}"

    def allocate_explicit(self, ns: str, desired_id: str, semantic_key: str) -> str:
        """Idempotently bind `semantic_key` to `desired_id`, rejecting collisions or retired IDs."""
        if semantic_key in self.by_key[ns]:
            existing = self.by_key[ns][semantic_key]
            if existing != desired_id:
                raise ImmutableIDViolationError(
                    f"Key `{semantic_key}` already bound to `{existing}`, cannot rebind to `{desired_id}`."
                )
            return existing
        if desired_id in self.retired[ns]:
            raise ImmutableIDViolationError(f"Retired ID `{desired_id}` is permanently sealed and cannot be recycled!")
        if desired_id in self.allocated[ns]:
            raise ImmutableIDViolationError(
                f"ID `{desired_id}` already owned by `{self.allocated[ns][desired_id]}`, cannot assign to `{semantic_key}`."
            )
        self.allocated[ns][desired_id] = semantic_key
        self.by_key[ns][semantic_key] = desired_id
        return desired_id

    def next_question_id(self, semantic_key: str, min_start: int = 1001) -> str:
        if semantic_key in self.by_key["Q"]:
            return self.by_key["Q"][semantic_key]
        used_nums = []
        for qid in list(self.allocated["Q"].keys()) + list(self.retired["Q"].keys()):
            m = re.match(r"^Q-(\d+)$", qid)
            if m:
                used_nums.append(int(m.group(1)))
        nxt = max([min_start - 1, *used_nums]) + 1
        candidate = f"Q-{nxt}"
        return self.allocate_explicit("Q", candidate, semantic_key)

    def to_dict(self) -> dict:
        return {
            "schema_version": self.schema_version,
            "counts": {ns: len(self.allocated[ns]) for ns in ("L", "Q", "E")},
            "retired_counts": {ns: len(self.retired[ns]) for ns in ("L", "Q", "E")},
            "allocated": self.allocated,
            "retired": self.retired,
        }

    def save(self, path: str | Path) -> None:
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
