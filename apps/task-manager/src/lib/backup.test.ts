import { describe, expect, it } from "vitest";
import { dumpPath, filePath, missingFiles, isStale, type StoredFile } from "./backup";

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

describe("vechimea copiei", () => {
  const azi = new Date(2026, 6, 31);

  it("o reușită de ieri e în regulă", () => {
    expect(isStale("2026-07-30T02:00:00Z", azi)).toBe(false);
  });

  it("trei zile încă trec", () => {
    expect(isStale("2026-07-28T02:00:00Z", azi)).toBe(false);
  });

  it("a patra zi e prea mult", () => {
    expect(isStale("2026-07-27T02:00:00Z", azi)).toBe(true);
  });

  it("nicio reușită vreodată înseamnă învechit", () => {
    // Nu „în regulă până la proba contrarie": un backup care n-a rulat
    // niciodată e exact cazul în care trebuie să afli.
    expect(isStale(null, azi)).toBe(true);
  });
});
