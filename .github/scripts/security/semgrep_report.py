#!/usr/bin/env python3
"""Normaliza a saida JSON do Semgrep e gera o resumo do job."""

from __future__ import annotations

import sys
from pathlib import Path

from report_utils import (
    finding_target,
    load_json,
    markdown_table,
    md_cell,
    normalize_severity,
    severity_table_rows,
    sort_findings,
    truncate,
    write_json,
    write_text,
)

RESULTS_DIR = Path("security-results")
SEMGREP_JSON = RESULTS_DIR / "semgrep.json"
NORMALIZED_JSON = RESULTS_DIR / "semgrep-findings.json"
SUMMARY_MD = RESULTS_DIR / "semgrep-summary.md"
MAX_DETAIL_ROWS = 60


def main() -> int:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    data = load_json(SEMGREP_JSON)
    if data is None:
        print("::error::semgrep.json nao foi gerado ou e invalido.")
        return 1

    findings = []
    for result in data.get("results", []):
        extra = result.get("extra") or {}
        metadata = extra.get("metadata") or {}
        references = metadata.get("references") or []
        if isinstance(references, str):
            references = [references]
        start = result.get("start") or {}
        remediation = metadata.get("remediation") or extra.get("message") or ""
        if isinstance(remediation, list):
            remediation = " ".join(str(item) for item in remediation)
        findings.append(
            {
                "tool": "Semgrep",
                "category": "SAST",
                "severity": normalize_severity(extra.get("severity")),
                "id": result.get("check_id") or "semgrep",
                "title": truncate(extra.get("message") or result.get("check_id"), 220),
                "target": result.get("path") or "",
                "line": start.get("line"),
                "installed_version": "",
                "fixed_version": "",
                "remediation": truncate(remediation, 500),
                "url": references[0] if references else "",
            }
        )

    findings = sort_findings(findings)
    write_json(NORMALIZED_JSON, findings)

    errors = data.get("errors") or []
    scanned = len((data.get("paths") or {}).get("scanned") or [])
    rows = severity_table_rows(findings)
    details = [
        [
            f"[{finding['severity']}]",
            md_cell(finding["id"], 70),
            f"`{md_cell(finding_target(finding), 90)}`",
            md_cell(finding["title"], 110),
        ]
        for finding in findings[:MAX_DETAIL_ROWS]
    ]

    lines = [
        "## 🔎 Semgrep (SAST)",
        "",
        f"**Arquivos analisados:** {scanned} · **Achados:** {len(findings)} · "
        f"**Erros do scanner:** {len(errors)}",
        "",
        markdown_table(["Severidade", "Achados"], rows),
    ]
    if details:
        lines += [
            "",
            "<details>",
            f"<summary>Achados ({len(findings)})</summary>",
            "",
            markdown_table(["Severidade", "Regra", "Local", "Mensagem"], details),
            "",
            "</details>",
        ]
    if len(findings) > MAX_DETAIL_ROWS:
        lines.append(f"\n> Exibindo {MAX_DETAIL_ROWS} de {len(findings)} achados.")
    if errors:
        lines += ["", "**Erros do Semgrep:**"]
        for error in errors[:10]:
            message = error.get("message") if isinstance(error, dict) else str(error)
            lines.append(f"- {md_cell(truncate(message, 300), 300)}")

    write_text(SUMMARY_MD, "\n".join(lines) + "\n")
    print(f"Semgrep: {len(findings)} achado(s), {len(errors)} erro(s) do scanner.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
