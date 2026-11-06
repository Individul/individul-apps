import { describe, expect, it, vi } from "vitest";

import {
  MESAJ_FILTRU,
  MESAJ_RETEA,
  MESAJ_SESIUNE,
  RUTA_URCARE,
  citesteCererea,
  urcaFisier,
} from "@/lib/attachment-upload";

const APP = "https://sarcini.dumitru.cloud";

function raspuns(body: string, init: ResponseInit & { url?: string; redirected?: boolean } = {}): Response {
  const r = new Response(body, init);
  if (init.url) Object.defineProperty(r, "url", { value: init.url });
  if (init.redirected) Object.defineProperty(r, "redirected", { value: true });
  return r;
}

describe("urcaFisier", () => {
  const poza = new File([new Uint8Array([1, 2, 3])], "Nițu Vasili scan.JPG", { type: "image/jpeg" });

  it("trimite fișierul ca atare, fără numele original, cu petiția și tipul în adresă", async () => {
    const trimite = vi.fn(async () => Response.json({ success: true }));
    expect(await urcaFisier("p1", "petitie", poza, trimite)).toEqual({ success: true });
    const [adresa, init] = trimite.mock.calls[0] as unknown as [string, RequestInit];
    expect(adresa).toBe(`${RUTA_URCARE}?petitie=p1&tip=petitie&ext=jpg`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(poza);
    expect(init.headers).toEqual({ "Content-Type": "image/jpeg" });
    expect(adresa).not.toMatch(/Vasili/);
  });

  it("întoarce mesajul de eroare al serverului", async () => {
    const trimite = vi.fn(async () => Response.json({ error: "Fișierul depășește 10 MB." }, { status: 413 }));
    expect(await urcaFisier("p1", "raspuns", poza, trimite)).toEqual({ error: "Fișierul depășește 10 MB." });
  });

  it("un 403 fără JSON e filtrul Cloudflare, și o spune", async () => {
    const trimite = vi.fn(async () => raspuns("<html>blocked</html>", { status: 403, headers: { "content-type": "text/html" } }));
    expect(await urcaFisier("p1", "petitie", poza, trimite)).toEqual({ error: MESAJ_FILTRU });
  });

  it("trimis la /login: sesiunea a expirat", async () => {
    const trimite = vi.fn(async () =>
      raspuns("<html>login</html>", { status: 200, url: `${APP}/login`, redirected: true, headers: { "content-type": "text/html" } }),
    );
    expect(await urcaFisier("p1", "petitie", poza, trimite)).toEqual({ error: MESAJ_SESIUNE });
  });

  it("rețea căzută: mesaj, nu excepție", async () => {
    const trimite = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await urcaFisier("p1", "petitie", poza, trimite)).toEqual({ error: MESAJ_RETEA });
  });

  it("alt cod: îl arată", async () => {
    const trimite = vi.fn(async () => raspuns("oops", { status: 502 }));
    expect((await urcaFisier("p1", "petitie", poza, trimite)).error).toMatch(/cod 502/);
  });
});

describe("citesteCererea", () => {
  function cerere(q: string, antete: Record<string, string> = { origin: APP }) {
    return new Request(`${APP}${RUTA_URCARE}?${q}`, { method: "POST", headers: antete });
  }

  it("acceptă o cerere din aplicație", () => {
    expect(citesteCererea(cerere("petitie=p1&tip=raspuns&ext=pdf"))).toEqual({
      ok: true,
      petitionId: "p1",
      kind: "raspuns",
      ext: "pdf",
    });
  });

  it("refuză o cerere fără origine sau de pe alt site", () => {
    expect(citesteCererea(cerere("petitie=p1&tip=petitie&ext=jpg", {}))).toMatchObject({ ok: false, status: 403 });
    expect(
      citesteCererea(cerere("petitie=p1&tip=petitie&ext=jpg", { origin: "https://rau.example" })),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("refuză tipul, petiția sau extensia lipsă", () => {
    expect(citesteCererea(cerere("petitie=p1&tip=altceva&ext=jpg"))).toMatchObject({ ok: false, status: 400 });
    expect(citesteCererea(cerere("tip=petitie&ext=jpg"))).toMatchObject({ ok: false, status: 400 });
    expect(citesteCererea(cerere("petitie=p1&tip=petitie&ext=../x"))).toMatchObject({ ok: false, status: 400 });
  });

  it("refuză din antet un fișier peste 10 MB, înainte de citire", () => {
    const r = cerere("petitie=p1&tip=petitie&ext=pdf", { origin: APP, "content-length": String(11 * 1024 * 1024) });
    expect(citesteCererea(r)).toMatchObject({ ok: false, status: 413 });
  });
});
