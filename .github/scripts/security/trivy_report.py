#!/usr/bin/env python3
"""Normaliza as saidas JSON do Trivy (vulnerabilidades, misconfig e segredos)."""

from __future__ import annotations

import sys
from pathlib import Path

from report_utils import (
    SEV_LABEL,
    SEV_ORDER,
    finding_target,
    load_dev_packages,
    load_json,
    markdown_table,
    md_cell,
    normalize_severity,
    severity_counts,
    severity_table_rows,
    sort_findings,
    truncate,
    write_json,
    write_text,
)

DEV_PACKAGES = load_dev_packages()

RESULTS_DIR = Path("security-results")
NORMALIZED_JSON = RESULTS_DIR / "trivy-findings.json"
SUMMARY_MD = RESULTS_DIR / "trivy-summary.md"

VULN_JSON = RESULTS_DIR / "trivy-vuln.json"
CONFIG_JSON = RESULTS_DIR / "trivy-config.json"
SECRET_JSON = RESULTS_DIR / "trivy-secret.json"

MAX_VULNS = 50
MAX_CONFIGS = 40
MAX_SECRETS = 30


def parse_vulnerabilities(data: dict, tool: str = "Trivy") -> list[dict]:
    findings = []
    for result in data.get("Results") or []:
        target_file = result.get("Target") or ""
        for vuln in result.get("Vulnerabilities") or []:
            package = vuln.get("PkgName") or "pacote"
            installed = vuln.get("InstalledVersion") or ""
            fixed = vuln.get("FixedVersion") or ""
            is_dev = package in DEV_PACKAGES
            if fixed:
                remediation = f"Atualizar {package} de {installed or '?'} para {fixed}."
            else:
                remediation = (
                    f"Nao ha versao corrigida publicada para {package} ({installed or '?'}). "
                    "Avaliar mitigacao, atualizacao de dependencia pai ou substituicao."
                )
            findings.append(
                {
                    "tool": tool,
                    "category": "Dependencia (dev)" if is_dev else "Dependencia",
                    "environment": "dev" if is_dev else "prod",
                    "severity": normalize_severity(vuln.get("Severity")),
                    "id": vuln.get("VulnerabilityID") or "CVE",
                    "title": truncate(
                        vuln.get("Title") or vuln.get("VulnerabilityID"), 220
                    ),
                    "target": package,
                    "source": target_file,
                    "installed_version": installed,
                    "fixed_version": fixed,
                    "remediation": remediation,
                    "url": vuln.get("PrimaryURL") or "",
                }
            )
    return findings


def parse_misconfigurations(data: dict) -> list[dict]:
    findings = []
    for result in data.get("Results") or []:
        target_file = result.get("Target") or ""
        for misconfig in result.get("Misconfigurations") or []:
            cause = misconfig.get("CauseMetadata") or {}
            line = cause.get("StartLine")
            message = misconfig.get("Message") or misconfig.get("Description") or ""
            resolution = misconfig.get("Resolution") or ""
            remediation = " ".join(part for part in (message, resolution) if part)
            findings.append(
                {
                    "tool": "Trivy",
                    "category": "Misconfiguracao",
                    "severity": normalize_severity(misconfig.get("Severity")),
                    "id": misconfig.get("ID") or misconfig.get("AVDID") or "misconfig",
                    "title": truncate(
                        misconfig.get("Title") or misconfig.get("ID"), 220
                    ),
                    "target": target_file,
                    "line": line,
                    "installed_version": "",
                    "fixed_version": "",
                    "remediation": truncate(remediation, 500),
                    "url": (misconfig.get("References") or [""])[0],
                }
            )
    return findings


def parse_secrets(data: dict) -> list[dict]:
    findings = []
    for result in data.get("Results") or []:
        target_file = result.get("Target") or ""
        for secret in result.get("Secrets") or []:
            findings.append(
                {
                    "tool": "Trivy",
                    "category": "Segredo",
                    "severity": normalize_severity(secret.get("Severity")),
                    "id": secret.get("RuleID") or "secret",
                    "title": truncate(
                        secret.get("Title") or secret.get("RuleID"), 220
                    ),
                    "target": target_file,
                    "line": secret.get("StartLine"),
                    "installed_version": "",
                    "fixed_version": "",
                    "remediation": (
                        "Remover o segredo do repositorio, rotacionar a credencial e "
                        "passar a usa-la via variavel de ambiente ou GitHub Secrets."
                    ),
                    "url": "",
                }
            )
    return findings


def category_counts(findings: list[dict]) -> list[list[str]]:
    categories = [
        category
        for category in ["Dependencia", "Dependencia (dev)", "Misconfiguracao", "Segredo"]
        if any(item.get("category") == category for item in findings)
    ]
    rows = []
    for category in categories:
        subset = [item for item in findings if item.get("category") == category]
        counts = severity_counts(subset)
        rows.append(
            [
                category,
                *(str(counts[sev]) for sev in SEV_ORDER),
                f"**{len(subset)}**",
            ]
        )
    total = severity_counts(findings)
    rows.append(
        [
            "**Total**",
            *(f"**{total[sev]}**" for sev in SEV_ORDER),
            f"**{len(findings)}**",
        ]
    )
    return rows


def main() -> int:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    vuln_data = load_json(VULN_JSON)
    config_data = load_json(CONFIG_JSON)
    secret_data = load_json(SECRET_JSON)

    if vuln_data is None and config_data is None and secret_data is None:
        print("::error::Nenhum resultado do Trivy foi gerado.")
        return 1

    findings: list[dict] = []
    if vuln_data is not None:
        findings += parse_vulnerabilities(vuln_data)
    if config_data is not None:
        findings += parse_misconfigurations(config_data)
    if secret_data is not None:
        findings += parse_secrets(secret_data)

    findings = sort_findings(findings)
    write_json(NORMALIZED_JSON, findings)

    vulns = [
        item for item in findings if str(item["category"]).startswith("Dependencia")
    ]
    configs = [item for item in findings if item["category"] == "Misconfiguracao"]
    secrets = [item for item in findings if item["category"] == "Segredo"]

    lines = [
        "## 🛡️ Trivy (dependencias, misconfiguracao e segredos)",
        "",
        f"**Achados:** {len(findings)} · **Vulnerabilidades:** {len(vulns)} · "
        f"**Misconfiguracoes:** {len(configs)} · **Segredos:** {len(secrets)}",
        "",
        markdown_table(
            ["Categoria", *[SEV_LABEL[sev] for sev in SEV_ORDER], "Total"],
            category_counts(findings),
        ),
    ]

    if vulns:
        rows = [
            [
                f"[{item['severity']}]",
                md_cell(item["id"], 40),
                md_cell(
                    ("[dev] " if item.get("environment") == "dev" else "")
                    + str(item["target"]),
                    40,
                ),
                md_cell(item.get("installed_version") or "—", 30),
                md_cell(item.get("fixed_version") or "sem correcao", 30),
            ]
            for item in vulns[:MAX_VULNS]
        ]
        lines += [
            "",
            "<details>",
            f"<summary>Vulnerabilidades em dependencias ({len(vulns)})</summary>",
            "",
            markdown_table(
                ["Severidade", "ID", "Pacote", "Versao atual", "Corrigir para"], rows
            ),
            "",
            "</details>",
        ]
        if len(vulns) > MAX_VULNS:
            lines.append(f"\n> Exibindo {MAX_VULNS} de {len(vulns)} vulnerabilidades.")

    if configs:
        rows = [
            [
                f"[{item['severity']}]",
                md_cell(item["id"], 30),
                f"`{md_cell(finding_target(item), 80)}`",
                md_cell(item["title"], 100),
            ]
            for item in configs[:MAX_CONFIGS]
        ]
        lines += [
            "",
            "<details>",
            f"<summary>Misconfiguracoes ({len(configs)})</summary>",
            "",
            markdown_table(["Severidade", "ID", "Local", "Problema"], rows),
            "",
            "</details>",
        ]
        if len(configs) > MAX_CONFIGS:
            lines.append(f"\n> Exibindo {MAX_CONFIGS} de {len(configs)} misconfiguracoes.")

    if secrets:
        rows = [
            [
                f"[{item['severity']}]",
                md_cell(item["id"], 40),
                f"`{md_cell(finding_target(item), 90)}`",
                md_cell(item["title"], 100),
            ]
            for item in secrets[:MAX_SECRETS]
        ]
        lines += [
            "",
            "<details>",
            f"<summary>Segredos detectados ({len(secrets)})</summary>",
            "",
            markdown_table(["Severidade", "Regra", "Local", "Tipo"], rows),
            "",
            "</details>",
        ]

    write_text(SUMMARY_MD, "\n".join(lines) + "\n")
    print(f"Trivy: {len(findings)} achado(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
