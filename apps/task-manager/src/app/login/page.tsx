"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithMagicLink } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Se trimite..." : "Trimite link de acces"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signInWithMagicLink, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Task Manager</h1>
          <p className="text-sm text-muted-foreground">
            Autentifică-te cu un link de acces trimis pe email.
          </p>
        </div>

        {state?.success ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Ți-am trimis un link de acces pe email. Verifică inbox-ul.
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nume@exemplu.com"
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
        )}
      </div>
    </main>
  );
}
