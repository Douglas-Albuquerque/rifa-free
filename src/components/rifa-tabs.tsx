"use client";

import { History, LayoutGrid, Ticket, Trophy, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const TABS = [
  { suffix: "", label: "Visão geral", icon: LayoutGrid },
  { suffix: "/participantes", label: "Participantes", icon: Ticket },
  { suffix: "/pagamentos", label: "Pagamentos", icon: Wallet },
  { suffix: "/sorteio", label: "Sorteio", icon: Trophy },
  { suffix: "/auditoria", label: "Auditoria", icon: History },
];

export function RifaTabs({ rifaId }: { rifaId: string }) {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-ink-200" aria-label="Seções da rifa">
      {TABS.map((tab) => {
        const href = `/rifas/${rifaId}${tab.suffix}`;
        const active = tab.suffix ? pathname.startsWith(`${href}/`) || pathname === href : pathname === href;
        return (
          <Link
            key={tab.suffix}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
              active
                ? "text-ink-950 after:bg-brand-600"
                : "text-ink-500 hover:text-ink-900 after:bg-transparent",
            )}
          >
            <tab.icon className="h-4 w-4" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
