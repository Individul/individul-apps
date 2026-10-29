"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sigla } from "@/components/layout/sigla";
import { signInWithPassword } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Se conectează..." : "Conectează-te"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(signInWithPassword, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        {/* Același nume ca în fila browserului („Sarcini · Secția evidența
            deținuți") și aceeași siglă ca în antet. Înainte scria „Task
            Manager", singurele cuvinte englezești pe care le vedea oricine
            deschidea aplicația (29.10.2026). */}
        <div className="mb-6 flex flex-col items-center gap-1.5 text-center">
          <span className="mb-1 [&>svg]:h-10 [&>svg]:w-10">
            <Sigla />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Sarcini</h1>
          <p className="text-sm text-muted-foreground">Secția evidența deținuți</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email sau nume de utilizator</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="email@exemplu.md sau nume.prenume"
              defaultValue={state?.identifier}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Parolă</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {state?.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <SubmitButton />
        </form>
      </div>
    </main>
  );
}
