import { Database, KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import type { Metadata } from "next";

import { requireSession } from "@/lib/auth";
import { APP_TIMEZONE } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/server/actions/auth-actions";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const user = await requireSession();
  const [rifas, reservas, participantes, sorteios] = await Promise.all([
    prisma.rifa.count(),
    prisma.reserva.count(),
    prisma.participante.count(),
    prisma.sorteio.count(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Configurações"
        title="Ajustes e segurança"
        description="Informações da conta administrativa, ambiente e políticas de operação."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-brand-700" aria-hidden />
            <h2 className="section-title">Conta do organizador</h2>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-ink-50 p-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {user.nome
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink-950">{user.nome}</p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
          </div>
          <form action={logoutAction} className="mt-4">
            <button type="submit" className="btn-secondary w-full text-red-700 hover:bg-red-50">
              <LogOut className="h-4 w-4" aria-hidden />
              Encerrar sessão
            </button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Para cadastrar outro administrador ou redefinir uma senha, use o comando documentado{" "}
            <code className="rounded bg-ink-100 px-1 py-0.5 text-[11px]">npm run admin:create</code> no servidor. Senhas são
            armazenadas com hash bcrypt.
          </p>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-brand-700" aria-hidden />
            <h2 className="section-title">Ambiente e dados</h2>
          </div>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-2.5">
              <dt className="text-ink-500">Banco de dados</dt>
              <dd className="font-medium text-ink-900">PostgreSQL · Prisma</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-2.5">
              <dt className="text-ink-500">Fuso horário</dt>
              <dd className="font-medium text-ink-900">{APP_TIMEZONE}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-2.5">
              <dt className="text-ink-500">Rifas / sorteios</dt>
              <dd className="font-medium text-ink-900">{rifas} / {sorteios}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-2.5">
              <dt className="text-ink-500">Reservas / participantes</dt>
              <dd className="font-medium text-ink-900">{reservas} / {participantes}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-500">Ambiente</dt>
              <dd className="font-medium text-ink-900">{process.env.NODE_ENV === "production" ? "Produção" : "Desenvolvimento"}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden />
            <h2 className="section-title">Proteções ativas</h2>
          </div>
          <ul className="space-y-2 text-sm text-ink-600">
            {[
              "Autenticação obrigatória e autorização no servidor.",
              "Sessão em cookie httpOnly, SameSite=Lax e Secure em HTTPS.",
              "Validação de dados com Zod no servidor e limites no banco.",
              "Restrição única de número por rifa garantida pelo PostgreSQL.",
              "Sorteio transacional com gerador criptográfico e registro de auditoria.",
              "Pagamentos e liberações exigem confirmação e ficam auditados.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-700" aria-hidden />
            <h2 className="section-title">Backup e recuperação</h2>
          </div>
          <p className="text-sm leading-relaxed text-ink-600">
            Faça backup diário do PostgreSQL com <code className="rounded bg-ink-100 px-1 py-0.5 text-[11px]">pg_dump</code> e
            guarde as cópias fora do servidor. Em produção, use HTTPS e mantenha as migrações aplicadas com{" "}
            <code className="rounded bg-ink-100 px-1 py-0.5 text-[11px]">prisma migrate deploy</code>.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            Procedimento completo de backup, restauração e implantação em <code className="rounded bg-ink-100 px-1 py-0.5">docs/DEPLOY.md</code>.
            Nunca versione o arquivo <code className="rounded bg-ink-100 px-1 py-0.5">.env</code> com credenciais reais.
          </p>
        </section>
      </div>
    </>
  );
}
