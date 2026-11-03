#!/usr/bin/env python3
"""Resume o SBOM CycloneDX e normaliza as vulnerabilidades encontradas no SBOM."""

from __future__ import annotations

import sys
from pathlib import Path

from report_utils import (
    load_json,
    markdown_table,
    severity_table_rows,
    write_json,
    write_text,
)
from trivy_report import parse_vulnerabilities

RESULTS_DIR = Path("security-results")
BOM_JSON = RESULTS_DIR / "bom.json"
SBOM_VULN_JSON = RESULTS_DIR / "sbom-vuln.json"
NORMALIZED_JSON = RESULTS_DIR / "sbom-findings.json"
META_JSON = RESULTS_DIR / "sbom-meta.json"
SUMMARY_MD = RESULTS_DIR / "sbom-summary.md"


def extract_licenses(component: dict) -> list[str]:
    licenses = []
    for entry in component.get("licenses") or []:
        if isinstance(entry, dict):
            license_info = entry.get("license") or {}
            expression = entry.get("expression")
            if expression:
                licenses.append(str(expression))
            elif license_info.get("id"):
                licenses.append(str(license_info["id"]))
            elif license_info.get("name"):
                licenses.append(str(license_info["name"]))
    return licenses


def main() -> int:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    bom = load_json(BOM_JSON)
    if bom is None:
        print("::error::bom.json nao foi gerado ou e invalido.")
        return 1

    components = bom.get("components") or []
    licenses: dict[str, int] = {}
    sem_licenca = 0
    for component in components:
        component_licenses = extract_licenses(component)
        if not component_licenses:
            sem_licenca += 1
        for license_name in component_licenses:
            licenses[license_name] = licenses.get(license_name, 0) + 1

    metadata = bom.get("metadata") or {}
    component_root = metadata.get("component") or {}
    meta = {
        "bomFormat": bom.get("bomFormat"),
        "specVersion": bom.get("specVersion"),
        "serialNumber": bom.get("serialNumber"),
        "timestamp": metadata.get("timestamp"),
        "aplicacao": component_root.get("name"),
        "versao": component_root.get("version"),
        "componentes": len(components),
        "sem_licenca": sem_licenca,
        "licencas": dict(sorted(licenses.items(), key=lambda item: (-item[1], item[0]))),
    }

    sbom_vulns = load_json(SBOM_VULN_JSON)
    findings = []
    if sbom_vulns is not None:
        findings = parse_vulnerabilities(sbom_vulns, tool="Trivy (SBOM)")
    write_json(NORMALIZED_JSON, findings)
    write_json(META_JSON, meta)

    top_licenses = list(meta["licencas"].items())[:10]
    lines = [
        "## 📦 CycloneDX (SBOM)",
        "",
        f"**Aplicacao:** {meta['aplicacao'] or '—'} {meta['versao'] or ''}".strip(),
        f"**Especificacao:** {meta['specVersion'] or '—'} · "
        f"**Componentes:** {meta['componentes']} · "
        f"**Sem licenca declarada:** {meta['sem_licenca']}",
        f"**Serial:** `{meta['serialNumber'] or '—'}`",
        "",
        markdown_table(
            ["Severidade", "Vulnerabilidades no SBOM"], severity_table_rows(findings)
        ),
    ]
    if top_licenses:
        lines += [
            "",
            markdown_table(
                ["Licenca", "Componentes"],
                [[license_name, str(count)] for license_name, count in top_licenses],
            ),
        ]
    lines += [
        "",
        "> O SBOM e analisado pelo Trivy (`trivy sbom`) para correlacionar "
        "componentes com vulnerabilidades conhecidas.",
    ]

    write_text(SUMMARY_MD, "\n".join(lines) + "\n")
    print(f"SBOM: {len(components)} componente(s), {len(findings)} vulnerabilidade(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
