import { afterEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { EROARE_NEPREVAZUTA, sigur } from "./sigur";

afterEach(() => vi.restoreAllMocks());

describe("sigur", () => {
  it("întoarce neschimbat rezultatul acțiunii, inclusiv un refuz obișnuit", async () => {
    expect(await sigur(async () => ({ success: true }))).toEqual({ success: true });
    expect(await sigur(async () => ({ error: "Doar adminul poate șterge." }))).toEqual({
      error: "Doar adminul poate șterge.",
    });
  });

  it("o eroare neprevăzută devine mesaj, iar eroarea ajunge în jurnal", async () => {
    const jurnal = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await sigur(async () => {
      throw new Error("D1_ERROR: database is overloaded");
    });
    expect(res).toEqual({ error: EROARE_NEPREVAZUTA });
    expect(jurnal).toHaveBeenCalledOnce();
    expect(String(jurnal.mock.calls[0][0])).toContain("database is overloaded");
  });

  it("lasă să treacă redirecționarea Next, care nu e o eroare", async () => {
    await expect(sigur(async () => redirect("/"))).rejects.toThrow("NEXT_REDIRECT");
  });
});
