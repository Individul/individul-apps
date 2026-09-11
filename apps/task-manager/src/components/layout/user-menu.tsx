"use client";

import { useState } from "react";
import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileDialog } from "@/components/account/profile-dialog";
import { ChangePasswordDialog } from "@/components/account/change-password-dialog";
import type { Profile } from "@/lib/types";

/**
 * Contul, adunat sub un singur buton.
 *
 * „Profilul meu", „Schimbă parola" și „Deconectare" stăteau alături în bară, ca
 * trei butoane conturate de aceeași mărime cu „Administrare". Făceau 328 de
 * pixeli din cei 512 ai blocului din dreapta — pe un telefon de 375px, două
 * rânduri întregi de antet pentru trei lucruri pe care omul le atinge de câteva
 * ori pe an. Măsurat: antetul coboară de la 229px la 185px.
 *
 * Nu e doar economie de loc. Trei butoane de rang egal spuneau că cele trei
 * acțiuni sunt la fel de importante ca intrarea în administrare, ceea ce nu e
 * adevărat pentru niciuna: nu le cauți, ți le amintești când ai nevoie de ele.
 * Un meniu de cont e locul unde le caută oricine, fiindcă acolo stau în orice
 * altă aplicație.
 *
 * Deconectarea rămâne un `form` care trimite POST, nu o legătură: o ieșire din
 * cont pe GET s-ar putea declanșa dintr-o simplă preîncărcare de pagină.
 */
export function UserMenu({ profile }: { profile: Profile | null }) {
  const [profilDeschis, setProfilDeschis] = useState(false);
  const [parolaDeschisa, setParolaDeschisa] = useState(false);

  const nume = profile?.full_name?.trim() || "Contul meu";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-6 w-6">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
            <AvatarFallback className="text-[10px]">{initiale(profile?.full_name)}</AvatarFallback>
          </Avatar>
          {/* Numele dispare sub 640px: acolo fiecare pixel de lățime înseamnă un
              rând de antet în plus, iar chipul și săgeata spun destul. */}
          <span className="hidden max-w-[12rem] truncate sm:inline">{nume}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </DropdownMenuTrigger>

        {/*
         * Focalizarea nu se întoarce pe buton la închidere.
         *
         * Radix o readuce acolo implicit — ceea ce e corect când meniul se
         * închide singur, dar nu și când se închide fiindcă tocmai a deschis o
         * fereastră: butonul ar smulge focalizarea de la primul câmp al
         * ferestrei, iar cine scrie din taste ar rămâne blocat afară.
         */}
        <DropdownMenuContent
          align="end"
          className="w-56"
          onCloseAutoFocus={(e) => {
            if (profilDeschis || parolaDeschisa) e.preventDefault();
          }}
        >
          {/* Numele se vede și aici, fiindcă pe telefon lipsește din buton. */}
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {nume}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setProfilDeschis(true)}
          >
            <UserRound className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
            Profilul meu
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={() => setParolaDeschisa(true)}
          >
            <KeyRound className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
            Schimbă parola
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Despărțită de celelalte: e singura de pe care nu te poți întoarce
              cu un clic. */}
          <DropdownMenuItem asChild className="cursor-pointer">
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex w-full items-center">
                <LogOut className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
                Deconectare
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ferestrele stau în afara meniului, nu înăuntru: un meniu care se
          închide și-ar duce cu el și fereastra deschisă din el. */}
      <ProfileDialog
        currentFullName={profile?.full_name ?? ""}
        currentUsername={profile?.username ?? ""}
        open={profilDeschis}
        onOpenChange={setProfilDeschis}
      />
      <ChangePasswordDialog open={parolaDeschisa} onOpenChange={setParolaDeschisa} />
    </>
  );
}

/** Primele litere ale numelui, ca în tabelul de utilizatori din administrare. */
function initiale(numeIntreg: string | null | undefined): string {
  if (!numeIntreg) return "—";
  const parti = numeIntreg.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "—";
  return parti
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
