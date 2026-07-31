import { describe, expect, it } from "vitest";
import {
  dumpPath,
  filePath,
  missingFiles,
  isStale,
  restoreRefusal,
  type StoredFile,
} from "./backup";

describe("căile din repo", () => {
  it("baza de date primește un fișier pe zi", () => {
    expect(dumpPath(new Date(2026, 6, 31))).toBe("db/2026-07-31.json");
  });

  it("fișierele păstrează bucketul în cale, ca să nu se ciocnească", () => {
    expect(filePath("petitions", "2026/cerere.pdf")).toBe("files/petitions/2026/cerere.pdf");
  });
});

describe("ce lipsește față de manifest", () => {
  const inBucket: StoredFile[] = [
    { bucket: "petitions", name: "a.pdf", size: 10 },
    { bucket: "petitions", name: "b.pdf", size: 20 },
    { bucket: "statistics", name: "c.xlsx", size: 30 },
  ];

  it("le dă pe cele care nu sunt salvate", () => {
    const saved = [{ bucket: "petitions", name: "a.pdf", size: 10 }];
    expect(missingFiles(inBucket, saved).map((f) => f.name)).toEqual(["b.pdf", "c.xlsx"]);
  });

  it("nimic de urcat când manifestul le are pe toate", () => {
    expect(missingFiles(inBucket, inBucket)).toEqual([]);
  });

  it("același nume în buckete diferite sunt fișiere diferite", () => {
    const bucket: StoredFile[] = [
      { bucket: "petitions", name: "x.pdf", size: 1 },
      { bucket: "statistics", name: "x.pdf", size: 1 },
    ];
    const saved = [{ bucket: "petitions", name: "x.pdf", size: 1 }];
    expect(missingFiles(bucket, saved)).toHaveLength(1);
    expect(missingFiles(bucket, saved)[0].bucket).toBe("statistics");
  });

  it("un fișier care și-a schimbat mărimea se urcă din nou", () => {
    // Scanurile nu se schimbă, dar dacă totuși se întâmplă, tăcerea ar fi
    // pierdere de date: manifestul ar spune „salvat" pentru altceva.
    const saved = [{ bucket: "petitions", name: "a.pdf", size: 999 }];
    expect(missingFiles(inBucket, saved).map((f) => f.name)).toContain("a.pdf");
  });
});

describe("ce refuză restaurarea automată", () => {
  it("refuză formatul complet și trimite la README", () => {
    // Butonul știe patru tabele din cincisprezece. Un import pe jumătate,
    // raportat ca reușită, e mai rău decât un refuz limpede.
    const refuz = restoreRefusal({ app: "task-manager", version: 2, data: {} });
    expect(refuz).toContain("README");
    expect(refuz).toContain("2");
  });

  it("acceptă formatul vechi", () => {
    expect(restoreRefusal({ app: "task-manager", version: 1, data: { tasks: [] } })).toBeNull();
  });

  it("un fișier fără versiune merge mai departe, la validarea de conținut", () => {
    // Nu e treaba refuzului să spună dacă fișierul e bun — doar dacă e prea
    // nou. Restul verificărilor sunt în acțiune, ca înainte.
    expect(restoreRefusal({ data: { tasks: [] } })).toBeNull();
    expect(restoreRefusal(null)).toBeNull();
    expect(restoreRefusal("nu-i un obiect")).toBeNull();
  });

  it("prinde versiunea scrisă ca text", () => {
    // JSON-ul vine dintr-un fișier ales de om; „2" în loc de 2 nu trebuie să
    // deschidă ușa pe care cifra o închide.
    expect(restoreRefusal({ version: "2" })).toContain("README");
  });

  it("refuză și un format viitor, nu doar 2", () => {
    // Regula e „mai nou decât știu să import", nu o listă de versiuni.
    expect(restoreRefusal({ version: 3 })).toContain("3");
  });
});

// Marcajele de timp sunt la prânz, nu la 02:00: un instant UTC aproape de
// miezul nopții cade pe altă zi calendaristică locală în funcție de fusul
// mașinii, iar testul ar trece aici și ar pica la altcineva. La prânz rămâne
// aceeași zi pe tot intervalul în care rulează aplicația (UTC pe Vercel).
describe("vechimea copiei", () => {
  const azi = new Date(2026, 6, 31);

  it("o reușită de ieri e în regulă", () => {
    expect(isStale("2026-07-30T12:00:00Z", azi)).toBe(false);
  });

  it("trei zile încă trec", () => {
    expect(isStale("2026-07-28T12:00:00Z", azi)).toBe(false);
  });

  it("a patra zi e prea mult", () => {
    expect(isStale("2026-07-27T12:00:00Z", azi)).toBe(true);
  });

  it("nicio reușită vreodată înseamnă învechit", () => {
    // Nu „în regulă până la proba contrarie": un backup care n-a rulat
    // niciodată e exact cazul în care trebuie să afli.
    expect(isStale(null, azi)).toBe(true);
  });

  it("un timestamp ilizibil e tot învechit", () => {
    // „Nu se poate citi" și „n-a rulat niciodată" primesc același răspuns,
    // fiindcă sunt aceeași situație: lipsește dovada că o copie a reușit.
    // Fără gardă, data invalidă dă NaN, iar `NaN > maxDays` e false — deci o
    // valoare stricată ar raporta „în regulă", exact minciuna de evitat.
    expect(isStale("nu-i o dată", azi)).toBe(true);
  });
});
