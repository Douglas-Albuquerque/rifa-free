#!/usr/bin/env python3
"""Resume o scan da imagem Docker e normaliza as vulnerabilidades encontradas."""

from __future__ import annotations

import sys
from pathlib import Path

from report_utils import (
    load_json,
    markdown_table,
    md_cell,
    severity_table_rows,
    sort_findings,
    write_json,
    write_text,
)
from trivy_report import parse_vulnerabilities

RESULTS_DIR = Path("security-results")
IMAGE_JSON = RESULTS_DIR / "image-vuln.json"
NORMALIZED_JSON = RESULTS_DIR / "image-findings.json"
SUMMARY_MD = RESULTS_DIR / "image-summary.md"

MAX_ROWS = 50


def main() -> int:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    data = load_json(IMAGE_JSON)
    if data is None:
        print("::error::image-vuln.json nao foi gerado ou e invalido.")
        return 1

    findings = parse_vulnerabilities(
        data,
        tool="Trivy (imagem)",
        category="Imagem",
        environment="prod",
    )
    findings = sort_findings(findings)
    write_json(NORMALIZED_JSON, findings)

    lines = [
        "## 🐳 Imagem Docker (Trivy)",
        "",
        f"**Achados:** {len(findings)} (SO + runtime, sem separacao dev/prod)",
        "",
        markdown_table(
            ["Severidade", "Achados"], severity_table_rows(findings)
        ),
    ]

    if findings:
        rows = [
            [
                f"[{item['severity']}]",
                md_cell(item["id"], 40),
                md_cell(item["target"], 30),
                md_cell(item.get("installed_version") or "—", 25),
                md_cell(item.get("fixed_version") or "sem correcao", 25),
            ]
            for item in findings[:MAX_ROWS]
        ]
        lines += [
            "",
            "<details>",
            f"<summary>Vulnerabilidades na imagem ({len(findings)})</summary>",
            "",
            markdown_table(
                ["Severidade", "ID", "Pacote", "Versao atual", "Corrigir para"],
                rows,
            ),
            "",
            "</details>",
        ]
        if len(findings) > MAX_ROWS:
            lines.append(f"\n> Exibindo {MAX_ROWS} de {len(findings)} achados.")
    else:
        lines += [
            "",
            "> Nenhuma vulnerabilidade conhecida na imagem final (SO + runtime).",
        ]

    write_text(SUMMARY_MD, "\n".join(lines) + "\n")
    print(f"Imagem Docker: {len(findings)} achado(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
