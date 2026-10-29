"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/**
 * Notificările (sonner) în tema paginii.
 *
 * Sonner își alege singur tema doar după sistem; dacă omul a ales manual
 * „Luminos" pe un Mac întunecat, mesajele ar fi ieșit negre pe pagina albă.
 * Aici urmărește clasa `dark` de pe <html>, singura sursă a temei.
 */
export function ToasterTema() {
  const [intunecat, setIntunecat] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const citeste = () => setIntunecat(html.classList.contains("dark"));
    citeste();
    const obs = new MutationObserver(citeste);
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return <Toaster richColors position="top-right" theme={intunecat ? "dark" : "light"} />;
}
