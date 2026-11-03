#!/usr/bin/env python3
"""Consolida os achados, publica o resumo no GitHub Actions e envia o email."""

from __future__ import annotations

import html
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

from report_utils import (
    SEV_LABEL,
    SEV_ORDER,
    dedupe_findings,
    finding_fix,
    finding_markdown,
    finding_target,
    load_json,
    markdown_table,
    md_cell,
    normalize_severity,
    severity_counts,
    severity_rank,
    sort_findings,
    tool_status_label,
    truncate,
    write_text,
)

RESULTS_DIR = Path("security-results")
REPORT_MD = RESULTS_DIR / "report.md"
MAX_BLOCKING = 60
MAX_OTHER = 100
MAX_EMAIL_BLOCKING = 50
MAX_EMAIL_OTHER = 20

INPUT_FILES = {
    "Semgrep": RESULTS_DIR / "semgrep-findings.json",
    "Trivy": RESULTS_DIR / "trivy-findings.json",
    "CycloneDX (SBOM)": RESULTS_DIR / "sbom-findings.json",
}


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def threshold_rank(value: str) -> tuple[int, str]:
    normalized = value.strip().upper()
    if normalized in {"NONE", "OFF", "NEVER", "DESLIGADO"}:
        return 99, "desligada"
    severity = normalize_severity(normalized)
    if severity == "UNKNOWN":
        severity = "HIGH"
    return severity_rank(severity), SEV_LABEL[severity]


def load_findings() -> tuple[list[dict], list[str]]:
    findings: list[dict] = []
    notes: list[str] = []
    for tool, path in INPUT_FILES.items():
        data = load_json(path)
        if data is None:
            notes.append(f"Resultado normalizado de {tool} nao encontrado.")
            continue
        if not isinstance(data, list):
            notes.append(f"Resultado normalizado de {tool} em formato inesperado.")
            continue
        findings.extend(item for item in data if isinstance(item, dict))
    return findings, notes


def execution_findings(notes: list[str]) -> list[dict]:
    findings = []
    statuses = {
        "Semgrep": env("SEMGREP_RESULT", "unknown"),
        "Trivy": env("TRIVY_RESULT", "unknown"),
        "CycloneDX (SBOM)": env("SBOM_RESULT", "unknown"),
    }
    for tool, status in statuses.items():
        if status.lower() not in {"success"}:
            findings.append(
                {
                    "tool": tool,
                    "category": "Erro de execucao",
                    "severity": "HIGH",
                    "id": f"{tool.lower().replace(' ', '-')}-execution",
                    "title": f"{tool} nao concluiu (status: {status})",
                    "target": "GitHub Actions",
                    "installed_version": "",
                    "fixed_version": "",
                    "remediation": (
                        f"Verificar os logs do job de {tool} e reexecutar a pipeline."
                    ),
                    "url": "",
                }
            )
    for note in notes:
        findings.append(
            {
                "tool": "Relatorio",
                "category": "Erro de execucao",
                "severity": "HIGH",
                "id": "report-missing-artifact",
                "title": note,
                "target": "GitHub Actions",
                "installed_version": "",
                "fixed_version": "",
                "remediation": "Verificar os passos de geracao e upload de artefatos.",
                "url": "",
            }
        )
    return findings


def category_table(findings: list[dict]) -> str:
    categories = sorted({str(item.get("category") or "Outro") for item in findings})
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
    return markdown_table(
        ["Categoria", *[SEV_LABEL[sev] for sev in SEV_ORDER], "Total"], rows
    )


def build_markdown(
    findings: list[dict],
    blocking: list[dict],
    successes: bool,
    threshold: str,
    email_status: str,
    sbom_meta: dict | None,
) -> str:
    repo = env("GITHUB_REPOSITORY", "—")
    ref = env("GITHUB_HEAD_REF") or env("GITHUB_REF_NAME", "—")
    event = env("GITHUB_EVENT_NAME", "—")
    actor = env("GITHUB_ACTOR", "—")
    sha = env("GITHUB_SHA", "")
    short_sha = sha[:7] if sha else "—"
    server = env("GITHUB_SERVER_URL", "https://github.com")
    run_id = env("GITHUB_RUN_ID", "")
    run_url = f"{server}/{repo}/actions/runs/{run_id}" if run_id else "—"
    commit_url = f"{server}/{repo}/commit/{sha}" if sha else "—"

    status_line = (
        f"✅ **SUCESSO** — nenhum achado a partir de **{threshold}**."
        if successes
        else f"❌ **FALHA** — {len(blocking)} achado(s) a partir de **{threshold}**."
    )
    dev_count = sum(1 for item in findings if item.get("environment") == "dev")

    lines = [
        "# 🔐 Analise de Seguranca",
        "",
        status_line,
        "",
    ]
    if dev_count:
        lines += [
            f"> {dev_count} achado(s) em dependencias de desenvolvimento (dev) "
            "sao informativos e nao bloqueiam o deploy.",
            "",
        ]
    lines += [
        markdown_table(
            ["Campo", "Valor"],
            [
                ["Repositorio", f"`{repo}`"],
                ["Evento", f"`{event}`"],
                ["Branch / ref", f"`{ref}`"],
                ["Commit", f"[`{short_sha}`]({commit_url})"],
                ["Autor", f"`{actor}`"],
                ["Politica de falha", f"achados >= **{threshold}**"],
                ["Execucao", f"[abrir run]({run_url})"],
            ],
        ),
        "",
        "## Resumo por severidade",
        "",
        markdown_table(
            ["Severidade", "Achados"],
            [
                [f"{SEV_LABEL[sev]}", str(count)]
                for sev, count in severity_counts(findings).items()
            ]
            + [["**Total**", f"**{len(findings)}**"]],
        ),
        "",
        "## Resumo por categoria",
        "",
        category_table(findings),
    ]

    if blocking:
        lines += [
            "",
            f"## 🚫 Achados bloqueadores ({len(blocking)})",
            "",
        ]
        for index, finding in enumerate(blocking[:MAX_BLOCKING], start=1):
            lines += [finding_markdown(finding, index), ""]
        if len(blocking) > MAX_BLOCKING:
            lines.append(
                f"> Exibindo {MAX_BLOCKING} de {len(blocking)} achados bloqueadores."
            )
    else:
        lines += ["", "## ✅ Nenhum achado bloqueador", ""]

    non_blocking = [item for item in findings if item not in blocking]
    if non_blocking:
        rows = [
            [
                f"[{normalize_severity(item.get('severity'))}]",
                md_cell(item.get("tool"), 30),
                md_cell(item.get("category"), 30),
                md_cell(item.get("target"), 50),
                md_cell(item.get("installed_version") or "—", 24),
                md_cell(item.get("fixed_version") or "sem correcao", 24),
            ]
            for item in non_blocking[:MAX_OTHER]
        ]
        lines += [
            "",
            f"## ℹ️ Demais achados ({len(non_blocking)})",
            "",
            markdown_table(
                [
                    "Severidade",
                    "Ferramenta",
                    "Categoria",
                    "Local",
                    "Versao atual",
                    "Corrigir para",
                ],
                rows,
            ),
        ]
        if len(non_blocking) > MAX_OTHER:
            lines.append(f"\n> Exibindo {MAX_OTHER} de {len(non_blocking)} achados.")

    if sbom_meta:
        lines += [
            "",
            "## 📦 SBOM (CycloneDX)",
            "",
            f"- **Aplicacao:** {sbom_meta.get('aplicacao') or '—'} "
            f"{sbom_meta.get('versao') or ''}".strip(),
            f"- **Especificacao:** {sbom_meta.get('specVersion') or '—'}",
            f"- **Componentes:** {sbom_meta.get('componentes', 0)}",
            f"- **Sem licenca declarada:** {sbom_meta.get('sem_licenca', 0)}",
            f"- **Serial:** `{sbom_meta.get('serialNumber') or '—'}`",
        ]

    lines += [
        "",
        "## ⚙️ Execucao das ferramentas",
        "",
        markdown_table(
            ["Ferramenta", "Status"],
            [
                ["Semgrep (SAST)", tool_status_label(env("SEMGREP_RESULT"))],
                ["Trivy (deps/misconfig/segredos)", tool_status_label(env("TRIVY_RESULT"))],
                ["CycloneDX (SBOM)", tool_status_label(env("SBOM_RESULT"))],
            ],
        ),
        "",
        f"**Email:** {email_status}",
        "",
        "> Relatorio gerado sem SARIF. Artefatos JSON ficam disponiveis na execucao "
        "por 7 dias.",
        "",
    ]
    return "\n".join(lines)


def build_email_text(
    findings: list[dict],
    blocking: list[dict],
    successes: bool,
    threshold: str,
    run_url: str,
) -> str:
    repo = env("GITHUB_REPOSITORY", "—")
    ref = env("GITHUB_HEAD_REF") or env("GITHUB_REF_NAME", "—")
    counts = severity_counts(findings)
    status = "SUCESSO" if successes else "FALHA"
    lines = [
        f"ANALISE DE SEGURANCA — {status}",
        f"Repositorio: {repo}",
        f"Branch/ref: {ref}",
        f"Commit: {env('GITHUB_SHA', '—')[:7]}",
        f"Politica: falha em achados >= {threshold}",
        f"Execucao: {run_url}",
        "",
        "RESUMO POR SEVERIDADE",
        *(f"- {SEV_LABEL[sev]}: {count}" for sev, count in counts.items()),
        f"- Total: {len(findings)}",
    ]
    dev_count = sum(1 for item in findings if item.get("environment") == "dev")
    if dev_count:
        lines.append(
            f"- Informativo: {dev_count} achado(s) em dependencias de "
            "desenvolvimento (nao bloqueiam)"
        )
    lines += ["", f"BLOQUEADORES ({len(blocking)})"]
    if blocking:
        for index, finding in enumerate(blocking[:MAX_EMAIL_BLOCKING], start=1):
            fix = finding_fix(finding)
            lines += [
                f"{index}. [{SEV_LABEL[normalize_severity(finding.get('severity'))]}] "
                f"{truncate(finding.get('title'), 180)}",
                f"   Ferramenta: {finding.get('tool')} | Categoria: {finding.get('category')}",
                f"   Local: {finding_target(finding)}",
            ]
            if fix != "—":
                lines.append(f"   Corrigir para: {fix}")
            remediation = truncate(finding.get("remediation"), 350)
            if remediation:
                lines.append(f"   Remediacao: {remediation}")
            url = str(finding.get("url") or "").strip()
            if url:
                lines.append(f"   Referencia: {url}")
        if len(blocking) > MAX_EMAIL_BLOCKING:
            lines.append(
                f"... e mais {len(blocking) - MAX_EMAIL_BLOCKING} bloqueador(es) no relatorio."
            )
    else:
        lines.append("Nenhum.")

    non_blocking = [item for item in findings if item not in blocking]
    if non_blocking:
        lines += ["", f"DEMAIS ACHADOS ({len(non_blocking)})"]
        for finding in non_blocking[:MAX_EMAIL_OTHER]:
            fix = finding_fix(finding)
            suffix = f" | corrigir para {fix}" if fix != "—" else ""
            dev_tag = " [dev]" if finding.get("environment") == "dev" else ""
            lines.append(
                f"- [{SEV_LABEL[normalize_severity(finding.get('severity'))]}] "
                f"{truncate(finding.get('title'), 140)} "
                f"({finding_target(finding)}){dev_tag}{suffix}"
            )
        if len(non_blocking) > MAX_EMAIL_OTHER:
            lines.append(
                f"... e mais {len(non_blocking) - MAX_EMAIL_OTHER} achado(s) no relatorio."
            )

    return "\n".join(lines) + "\n"


def build_email_html(
    findings: list[dict],
    blocking: list[dict],
    successes: bool,
    threshold: str,
    run_url: str,
) -> str:
    repo = env("GITHUB_REPOSITORY", "—")
    ref = env("GITHUB_HEAD_REF") or env("GITHUB_REF_NAME", "—")
    counts = severity_counts(findings)
    status = "SUCESSO" if successes else "FALHA"
    color = "#15803d" if successes else "#b91c1c"
    background = "#f0fdf4" if successes else "#fef2f2"
    esc = html.escape

    def finding_html(finding: dict) -> str:
        fix = finding_fix(finding)
        parts = [
            f"<li style='margin:0 0 14px 0'>",
            f"<strong>[{esc(SEV_LABEL[normalize_severity(finding.get('severity'))])}] "
            f"{esc(truncate(finding.get('title'), 200))}</strong><br>",
            f"<span style='color:#475569'>Ferramenta: {esc(str(finding.get('tool')))} | "
            f"Categoria: {esc(str(finding.get('category')))}</span><br>",
            f"<span style='color:#475569'>Local: <code>{esc(finding_target(finding))}</code></span>",
        ]
        if finding.get("environment") == "dev":
            parts.append(
                "<br><span style='color:#64748b'>Ambiente: desenvolvimento "
                "(informativo, nao bloqueia)</span>"
            )
        if fix != "—":
            parts.append(
                f"<br><span style='color:#475569'>Corrigir para: <code>{esc(fix)}</code></span>"
            )
        remediation = truncate(finding.get("remediation"), 400)
        if remediation:
            parts.append(
                f"<br><span style='color:#475569'>Remediacao: {esc(remediation)}</span>"
            )
        url = str(finding.get("url") or "").strip()
        if url:
            parts.append(
                f"<br><a href='{esc(url)}' style='color:#1d4ed8'>Referencia</a>"
            )
        parts.append("</li>")
        return "".join(parts)

    severity_rows = "".join(
        f"<tr><td style='padding:4px 8px'>{esc(SEV_LABEL[sev])}</td>"
        f"<td style='padding:4px 8px;text-align:right'>{count}</td></tr>"
        for sev, count in counts.items()
    )
    blocking_html = (
        "<ul style='padding-left:18px;margin:8px 0'>"
        + "".join(finding_html(item) for item in blocking[:MAX_EMAIL_BLOCKING])
        + "</ul>"
    )
    if not blocking:
        blocking_html = "<p>Nenhum achado bloqueador.</p>"
    if len(blocking) > MAX_EMAIL_BLOCKING:
        blocking_html += (
            f"<p>... e mais {len(blocking) - MAX_EMAIL_BLOCKING} bloqueador(es) "
            "no relatorio completo.</p>"
        )
    non_blocking = [item for item in findings if item not in blocking]
    other_html = ""
    if non_blocking:
        other_html = (
            f"<h3>Demais achados ({len(non_blocking)})</h3>"
            + "<ul style='padding-left:18px;margin:8px 0'>"
            + "".join(finding_html(item) for item in non_blocking[:MAX_EMAIL_OTHER])
            + "</ul>"
        )
        if len(non_blocking) > MAX_EMAIL_OTHER:
            other_html += (
                f"<p>... e mais {len(non_blocking) - MAX_EMAIL_OTHER} achado(s) "
                "no relatorio completo.</p>"
            )

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:760px;margin:0 auto;padding:24px">
    <div style="background:{background};border-left:6px solid {color};padding:16px 20px;border-radius:8px">
      <h1 style="margin:0;font-size:20px;color:{color}">Analise de Seguranca — {esc(status)}</h1>
      <p style="margin:8px 0 0;color:#334155">
        <strong>{esc(repo)}</strong> · branch/ref <code>{esc(ref)}</code> ·
        politica: falha em achados &gt;= <strong>{esc(threshold)}</strong>
      </p>
    </div>

    <p style="margin:16px 0">
      <a href="{esc(run_url)}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
        Abrir execucao no GitHub Actions
      </a>
    </p>

    <h2 style="font-size:16px;margin:20px 0 8px">Resumo por severidade</h2>
    <table style="border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;min-width:240px">
      {severity_rows}
      <tr><td style="padding:6px 8px;border-top:1px solid #e2e8f0"><strong>Total</strong></td>
      <td style="padding:6px 8px;border-top:1px solid #e2e8f0;text-align:right"><strong>{len(findings)}</strong></td></tr>
    </table>

    <h2 style="font-size:16px;margin:20px 0 8px">Achados bloqueadores ({len(blocking)})</h2>
    {blocking_html}
    {other_html}

    <h2 style="font-size:16px;margin:20px 0 8px">SBOM (CycloneDX)</h2>
    <p style="color:#475569;margin:4px 0">
      O SBOM e gerado a cada execucao e analisado pelo Trivy. Consulte os artefatos da execucao.
    </p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#64748b;font-size:12px;margin:0">
      Relatorio gerado automaticamente. Sem SARIF; artefatos JSON disponiveis por 7 dias na execucao.
    </p>
  </div>
</body>
</html>
"""


def send_email(subject: str, text: str, html_body: str) -> tuple[bool, str]:
    host = env("SMTP_HOST")
    port_raw = env("SMTP_PORT", "587")
    security = env("SMTP_SECURITY").lower()
    username = env("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD", "")
    mail_from = env("MAIL_FROM") or username
    mail_to = [
        item.strip()
        for item in env("MAIL_TO").replace(";", ",").split(",")
        if item.strip()
    ]

    if not host or not username or not password or not mail_from or not mail_to:
        return (
            False,
            "nao enviado (configure SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, "
            "MAIL_FROM e MAIL_TO nos Secrets do repositorio)",
        )

    try:
        port = int(port_raw)
    except ValueError:
        port = 587
    if not security:
        security = "ssl" if port == 465 else "starttls"

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = mail_from
    message["To"] = ", ".join(mail_to)
    message["Date"] = formatdate(localtime=True)
    message["Message-ID"] = make_msgid()
    message.set_content(text)
    message.add_alternative(html_body, subtype="html")

    try:
        if security == "ssl":
            with smtplib.SMTP_SSL(
                host, port, timeout=30, context=ssl.create_default_context()
            ) as smtp:
                smtp.login(username, password)
                smtp.send_message(message)
        elif security == "none":
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.ehlo()
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
                smtp.login(username, password)
                smtp.send_message(message)
    except Exception as error:  # noqa: BLE001 - nunca interromper o relatorio por falha de email
        return False, f"falhou ({type(error).__name__}: {error})"

    return True, f"enviado para {', '.join(mail_to)}"


def main() -> int:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    findings, notes = load_findings()
    findings += execution_findings(notes)
    findings = sort_findings(dedupe_findings(findings))

    threshold, threshold_label = threshold_rank(env("FAIL_ON_SEVERITY", "high"))
    blocking = [
        item
        for item in findings
        if severity_rank(item.get("severity")) >= threshold
        # Vulnerabilidades de devDependencies sao reportadas, mas nao bloqueiam
        # o deploy de producao (ferramentas de teste/build).
        and item.get("environment") != "dev"
    ]
    successes = not blocking

    server = env("GITHUB_SERVER_URL", "https://github.com")
    repo = env("GITHUB_REPOSITORY", "—")
    run_id = env("GITHUB_RUN_ID", "")
    run_url = f"{server}/{repo}/actions/runs/{run_id}" if run_id else "—"

    text_body = build_email_text(findings, blocking, successes, threshold_label, run_url)
    html_body = build_email_html(
        findings, blocking, successes, threshold_label, run_url
    )

    counts = severity_counts(findings)
    blocking_counts = severity_counts(blocking)
    subject_counts = ", ".join(
        f"{count} {SEV_LABEL[sev].lower()}(s)"
        for sev, count in blocking_counts.items()
        if count
    )
    result_label = "SUCESSO" if successes else "FALHA"
    subject = (
        f"[security] {'✅' if successes else '❌'} {result_label} — {repo} "
        f"({env('GITHUB_HEAD_REF') or env('GITHUB_REF_NAME', '—')})"
    )
    if subject_counts:
        subject += f" — {subject_counts}"
    subject = truncate(subject, 150)

    email_ok, email_status = send_email(subject, text_body, html_body)
    if email_ok:
        print(f"::notice::Email de seguranca enviado: {email_status}")
    else:
        print(f"::warning::Email de seguranca {email_status}")

    markdown_report = build_markdown(
        findings,
        blocking,
        successes,
        threshold_label,
        email_status,
        load_json(RESULTS_DIR / "sbom-meta.json"),
    )
    write_text(REPORT_MD, markdown_report)

    summary_path = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(markdown_report + "\n")

    print(markdown_report)
    print(
        f"Resultado: {result_label} | achados={len(findings)} | "
        f"bloqueadores={len(blocking)} | severidades={counts}"
    )
    return 0 if successes else 1


if __name__ == "__main__":
    sys.exit(main())
