"""Utilitarios compartilhados pelos scripts de relatorio de seguranca."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

SEV_ORDER = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
    "INFO": 0,
    "UNKNOWN": 0,
}

SEV_LABEL = {
    "CRITICAL": "Critico",
    "HIGH": "Alto",
    "MEDIUM": "Medio",
    "LOW": "Baixo",
    "INFO": "Info",
    "UNKNOWN": "Desconhecido",
}

SEV_EMOJI = {
    "CRITICAL": "🟥",
    "HIGH": "🟧",
    "MEDIUM": "🟨",
    "LOW": "🟦",
    "INFO": "⬜",
    "UNKNOWN": "⬜",
}


def normalize_severity(value: str | None) -> str:
    """Converte severidades de ferramentas diferentes para o mesmo vocabulario."""
    raw = (value or "").strip().upper()
    aliases = {
        "ERROR": "HIGH",
        "WARNING": "MEDIUM",
        "WARN": "MEDIUM",
        "MODERATE": "MEDIUM",
        "INFO": "LOW",
        "INFORMATIONAL": "LOW",
    }
    normalized = aliases.get(raw, raw)
    return normalized if normalized in SEV_ORDER else "UNKNOWN"


def severity_rank(value: str | None) -> int:
    return SEV_ORDER[normalize_severity(value)]


def load_dev_packages(root: str | Path = ".") -> set[str]:
    """Nomes de pacotes que existem apenas em devDependencies (package-lock v2/v3)."""
    lock = load_json(Path(root) / "package-lock.json")
    if not isinstance(lock, dict):
        return set()
    dev: set[str] = set()
    for key, info in (lock.get("packages") or {}).items():
        if not key.startswith("node_modules/") or not isinstance(info, dict):
            continue
        if info.get("dev") is True:
            dev.add(key.split("node_modules/")[-1].rstrip("/"))
    return dev


def load_json(path: str | Path) -> Any | None:
    file = Path(path)
    if not file.exists() or file.stat().st_size == 0:
        return None
    try:
        return json.loads(file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def write_json(path: str | Path, data: Any) -> None:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: str | Path, text: str) -> None:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(text, encoding="utf-8")


def truncate(text: str | None, limit: int = 300) -> str:
    clean = " ".join(str(text or "").split())
    return clean if len(clean) <= limit else clean[: limit - 1] + "…"


def count_by(findings: Iterable[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for finding in findings:
        value = str(finding.get(key) or "UNKNOWN")
        counts[value] = counts.get(value, 0) + 1
    return counts


def severity_counts(findings: Iterable[dict[str, Any]]) -> dict[str, int]:
    counts = {sev: 0 for sev in SEV_ORDER}
    for finding in findings:
        counts[normalize_severity(finding.get("severity"))] += 1
    return counts


def md_cell(value: Any, limit: int = 120) -> str:
    return truncate(str(value or ""), limit).replace("|", "\\|")


def severity_badge(severity: str | None) -> str:
    normalized = normalize_severity(severity)
    return f"{SEV_EMOJI[normalized]} {SEV_LABEL[normalized]}"


def severity_table_rows(findings: Iterable[dict[str, Any]]) -> list[list[str]]:
    counts = severity_counts(findings)
    total = sum(counts.values())
    rows = [[f"{SEV_EMOJI[sev]} {SEV_LABEL[sev]}", str(counts[sev])] for sev in SEV_ORDER]
    rows.append(["**Total**", f"**{total}**"])
    return rows


def markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    header = "| " + " | ".join(headers) + " |"
    separator = "| " + " | ".join("---" for _ in headers) + " |"
    body = ["| " + " | ".join(row) + " |" for row in rows]
    return "\n".join([header, separator, *body])


def finding_target(finding: dict[str, Any]) -> str:
    target = str(finding.get("target") or "").strip()
    line = finding.get("line")
    if target and line and ":" not in target:
        return f"{target}:{line}"
    return target or "—"


def finding_fix(finding: dict[str, Any]) -> str:
    fixed = str(finding.get("fixed_version") or "").strip()
    if fixed:
        installed = str(finding.get("installed_version") or "").strip()
        if installed:
            return f"`{installed}` → `{fixed}`"
        return f"`{fixed}`"
    return "—"


def finding_markdown(finding: dict[str, Any], index: int | None = None) -> str:
    number = f"{index}. " if index is not None else ""
    lines = [
        f"{number}**[{SEV_LABEL[normalize_severity(finding.get('severity'))]}] "
        f"{truncate(finding.get('title'), 180)}**",
        f"   - **Ferramenta:** {finding.get('tool', '—')} · **Categoria:** {finding.get('category', '—')}",
        f"   - **Identificador:** `{finding.get('id', '—')}`",
        f"   - **Local:** `{finding_target(finding)}`",
    ]
    fix = finding_fix(finding)
    if fix != "—":
        lines.append(f"   - **Corrigir para:** {fix}")
    if finding.get("environment") == "dev":
        lines.append("   - **Ambiente:** desenvolvimento (informativo, nao bloqueia)")
    remediation = truncate(finding.get("remediation"), 400)
    if remediation:
        lines.append(f"   - **Remediacao:** {remediation}")
    url = str(finding.get("url") or "").strip()
    if url:
        lines.append(f"   - **Referencia:** {url}")
    return "\n".join(lines)


def tool_status_label(status: str | None) -> str:
    normalized = (status or "unknown").lower()
    icons = {
        "success": "✅ sucesso",
        "failure": "❌ falha",
        "cancelled": "⚪ cancelado",
        "skipped": "⚪ ignorado",
        "unknown": "⚪ desconhecido",
    }
    return icons.get(normalized, f"⚪ {normalized}")


def dedupe_findings(findings: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicatas entre Trivy FS e Trivy SBOM, mantendo a maior severidade."""
    merged: dict[tuple[str, str, str], dict[str, Any]] = {}
    for finding in findings:
        key = (
            str(finding.get("id") or "").lower(),
            str(finding.get("target") or "").lower(),
            str(finding.get("installed_version") or "").lower(),
        )
        current = merged.get(key)
        if current is None:
            merged[key] = {**finding, "tools": [finding.get("tool")]}
            continue
        if severity_rank(finding.get("severity")) > severity_rank(current.get("severity")):
            current["severity"] = normalize_severity(finding.get("severity"))
        for field in ("fixed_version", "remediation", "url", "title"):
            if finding.get(field) and not current.get(field):
                current[field] = finding[field]
        tool = finding.get("tool")
        if tool and tool not in current["tools"]:
            current["tools"].append(tool)
    result = []
    for finding in merged.values():
        finding["tool"] = " + ".join(str(tool) for tool in finding.get("tools") or [])
        result.append(finding)
    return result


def sort_findings(findings: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        findings,
        key=lambda item: (
            -severity_rank(item.get("severity")),
            str(item.get("category") or ""),
            str(item.get("title") or ""),
        ),
    )
