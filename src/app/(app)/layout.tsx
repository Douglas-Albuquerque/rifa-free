import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  return <AppShell user={{ nome: user.nome, email: user.email }}>{children}</AppShell>;
}
