import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-ink-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="relative">
          <Logo />
        </div>

        <div className="relative max-w-lg">
          <p className="eyebrow !text-brand-400">Controle total, sem planilhas</p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white">
            Sua rifa organizada do primeiro número ao vencedor.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-300">
            Reservas seguras, pagamentos conferidos e sorteios auditáveis. Tudo em um painel simples de usar no celular.
          </p>
        </div>

        <div className="relative grid max-w-md grid-cols-5 gap-2" aria-hidden>
          {[7, 18, 23, 41, 56].map((numero, index) => (
            <div
              key={numero}
              className={
                index === 3
                  ? "grid aspect-square place-items-center rounded-xl border border-amber-300/40 bg-amber-400/15 text-sm font-semibold text-amber-200"
                  : index === 1
                    ? "grid aspect-square place-items-center rounded-xl border border-brand-400/30 bg-brand-400/10 text-sm font-semibold text-brand-200"
                    : "grid aspect-square place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-ink-300"
              }
            >
              {String(numero).padStart(3, "0")}
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex items-center gap-2.5">
              <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-ink-950">
                <span className="h-5 w-5 rounded-full border-2 border-brand-400" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-400" />
              </span>
              <span className="font-display text-2xl font-semibold tracking-tight text-ink-950">
                Rifas<span className="text-brand-600">.</span>
              </span>
            </span>
          </div>

          <p className="eyebrow">Área do organizador</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-950">Bem-vindo de volta</h2>
          <p className="mt-2 text-sm text-ink-500">Entre para gerenciar suas rifas e reservas.</p>

          <div className="mt-8">
            <LoginForm next={next} />
          </div>
        </div>
      </section>
    </main>
  );
}
