"use client";

import {
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/server/actions/auth-actions";
import { cn } from "@/lib/cn";

import { Logo } from "./ui";
import { Toaster } from "./toast";

const NAV = [
  { href: "/", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/rifas", label: "Minhas rifas", icon: Ticket },
  { href: "/pesquisa", label: "Pesquisa", icon: Search },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/configuracoes", label: "Ajustes", icon: Settings },
];

const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[4]];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  children,
}: {
  user: { nome: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const iniciais = user.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-ink-950 md:flex">
        <div className="border-b border-white/5 px-5 py-5">
          <Link href="/" className="rounded-xl">
            <Logo />
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-ink-400">Gestão de rifas</p>
        </div>

        <div className="px-3 pt-4">
          <Link href="/rifas/nova" className="btn w-full bg-brand-500 text-ink-950 hover:bg-brand-400">
            <Plus className="h-4 w-4" aria-hidden />
            Nova rifa
          </Link>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3" aria-label="Navegação principal">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-white ring-1 ring-white/10"
                    : "text-ink-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className={cn("h-[18px] w-[18px]", active ? "text-brand-400" : "text-ink-400")} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-300 ring-1 ring-brand-400/20">
              {iniciais || "OR"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.nome}</p>
              <p className="truncate text-[11px] text-ink-400">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="rounded-lg p-2 text-ink-400 transition hover:bg-white/5 hover:text-white" aria-label="Sair da conta">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-100 bg-paper/85 px-4 backdrop-blur-md md:hidden">
        <Link href="/" className="flex items-center gap-2 rounded-lg" aria-label="Ir para o painel">
          <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-ink-950">
            <span className="h-4 w-4 rounded-full border-2 border-brand-400" />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
          </span>
          <span className="font-display text-lg font-semibold text-ink-950">
            Rifas<span className="text-brand-600">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/rifas/nova" className="btn-primary btn-sm" aria-label="Criar nova rifa">
            <Plus className="h-4 w-4" aria-hidden />
            Nova
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn-ghost h-9 min-h-9 w-9 rounded-lg p-0" aria-label="Sair da conta">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="px-4 pb-28 pt-5 sm:px-6 md:ml-64 md:px-8 md:pb-12 md:pt-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-cream/95 backdrop-blur-md md:hidden"
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition",
                  active ? "text-brand-800" : "text-ink-500 hover:text-ink-800",
                )}
              >
                <span className={cn("grid h-7 w-9 place-items-center rounded-lg", active && "bg-brand-100")}>
                  <item.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                {item.label === "Minhas rifas" ? "Rifas" : item.label === "Configurações" ? "Ajustes" : item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <Toaster />
    </div>
  );
}
