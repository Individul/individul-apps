/**
 * Tema aplicației: luminoasă, întunecată sau cea a sistemului (29.10.2026).
 *
 * Alegerea stă în `localStorage`, pe dispozitiv, nu în profil: pe calculatorul
 * de la birou poate fi luminoasă, pe telefon seara întunecată. Implicit,
 * „Sistem": urmează setarea Mac-ului sau a Windows-ului, iar dacă acolo se
 * schimbă singură seara, aplicația se schimbă odată cu ea.
 *
 * Clasa `dark` pe <html> o pune scriptul de mai jos, în <head>, înainte de
 * prima desenare. Pusă abia din React, pagina ar clipi întâi albă la fiecare
 * deschidere, pe un ecran întunecat exact clipitul care deranjează.
 */
export type Tema = "sistem" | "luminos" | "intunecat";

const CHEIE = "tema";
const MEDIA = "(prefers-color-scheme: dark)";

/** Scriptul din <head>. Scris de mână, fără importuri: rulează înainte de orice. */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CHEIE}");var d=t==="intunecat"||(t!=="luminos"&&matchMedia("${MEDIA}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function citesteTema(): Tema {
  try {
    const t = localStorage.getItem(CHEIE);
    return t === "luminos" || t === "intunecat" ? t : "sistem";
  } catch {
    return "sistem";
  }
}

/** Pune clasa `dark` după temă; la „sistem", după setarea de acum a sistemului. */
export function aplicaTema(tema: Tema): void {
  const intunecat = tema === "intunecat" || (tema === "sistem" && window.matchMedia(MEDIA).matches);
  document.documentElement.classList.toggle("dark", intunecat);
}

export function salveazaTema(tema: Tema): void {
  try {
    if (tema === "sistem") localStorage.removeItem(CHEIE);
    else localStorage.setItem(CHEIE, tema);
  } catch {
    // Fereastră privată sau stocare blocată: tema ține până la reîncărcare.
  }
  aplicaTema(tema);
}

/** Urmărește schimbarea setării sistemului cât timp tema e „sistem". Întoarce oprirea. */
export function urmaresteSistemul(): () => void {
  const mq = window.matchMedia(MEDIA);
  const laSchimbare = () => {
    if (citesteTema() === "sistem") aplicaTema("sistem");
  };
  mq.addEventListener("change", laSchimbare);
  return () => mq.removeEventListener("change", laSchimbare);
}
