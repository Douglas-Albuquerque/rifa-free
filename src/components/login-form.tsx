"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useActionState, useState } from "react";

import { loginAction } from "@/server/actions/auth-actions";

import { Alert } from "./ui";
import { SubmitButton } from "./submit-button";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(loginAction, null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      {state && !state.ok ? <Alert type="error">{state.message}</Alert> : null}

      <div>
        <label htmlFor="email" className="label">
          E-mail do organizador
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className="input pl-10"
            placeholder="voce@exemplo.com"
            aria-invalid={Boolean(state?.fieldErrors?.email)}
          />
        </div>
        {state?.fieldErrors?.email ? <p className="mt-1 text-xs text-red-700">{state.fieldErrors.email[0]}</p> : null}
      </div>

      <div>
        <label htmlFor="senha" className="label">
          Senha
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input px-10"
            placeholder="Sua senha"
            aria-invalid={Boolean(state?.fieldErrors?.senha)}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((value) => !value)}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {state?.fieldErrors?.senha ? <p className="mt-1 text-xs text-red-700">{state.fieldErrors.senha[0]}</p> : null}
      </div>

      <SubmitButton className="mt-2 w-full" pendingLabel="Entrando...">
        Entrar no painel
      </SubmitButton>

      <p className="text-center text-xs leading-relaxed text-ink-500">
        Acesso restrito ao organizador. Sessão protegida por cookie seguro.
      </p>
    </form>
  );
}
