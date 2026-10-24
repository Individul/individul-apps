import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { createTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import * as a from "./attachments";
import { memoryStore } from "./memory-store";
import { ADMIN, ANA, BOB, seedPeople } from "./test-helpers";

let db: Db;
let dispose: () => Promise<void>;
const PID = "11111111-1111-4111-8111-111111111111";

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
  await seedPeople(db);
});
afterAll(() => dispose());

beforeEach(async () => {
  for (const table of [s.auditLog, s.petitionAttachments, s.petitions]) await db.delete(table);
  // Petiție a lui Ana, pe numele ei; Bob e străin de ea.
  await db.insert(s.petitions).values({
    id: PID,
    number: "M-535/26",
    petitioner: "Ion Popescu",
    received_date: "2026-10-01",
    created_by: ANA.id,
    assignee_id: ANA.id,
  });
});

const pdf = (size = 4, name = "Scanare Ședință.pdf") => ({
  name,
  type: "application/pdf",
  size,
  arrayBuffer: async () => new Uint8Array(size).buffer,
});

describe("fișierele: încărcarea", () => {
  it("fără sesiune nu urcă nimic", async () => {
    const files = memoryStore();
    expect(await a.uploadAttachment(db, files, null, { petitionId: PID, kind: "petitie", file: pdf() })).toEqual({
      error: "Neautentificat.",
    });
    expect(files.keys()).toEqual([]);
  });

  it("un străin de petiție nu urcă; responsabilul și adminul da", async () => {
    const files = memoryStore();
    expect((await a.uploadAttachment(db, files, BOB, { petitionId: PID, kind: "petitie", file: pdf() })).error).toBe(
      "Petiție inexistentă sau fără permisiune.",
    );
    expect(files.keys()).toEqual([]);
    expect(await a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: pdf() })).toEqual({
      success: true,
    });
    expect(await a.uploadAttachment(db, files, ADMIN, { petitionId: PID, kind: "raspuns", file: pdf() })).toEqual({
      success: true,
    });
    expect(files.keys()).toHaveLength(2);
  });

  it("refuză tipul și mărimea pe care le refuza bucketul", async () => {
    const files = memoryStore();
    const doc = { ...pdf(), type: "application/msword", name: "a.doc" };
    expect((await a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: doc })).error).toBe(
      "Sunt acceptate doar fișiere PDF, JPG sau PNG.",
    );
    const big = pdf(10 * 1024 * 1024 + 1);
    expect((await a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: big })).error).toBe(
      "Fișierul depășește 10 MB.",
    );
    expect(files.keys()).toEqual([]);
  });

  it("cheia e în formatul vechi, numele e generat, cu indice de la al doilea", async () => {
    const files = memoryStore();
    await a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: pdf() });
    await a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: pdf() });
    const rows = await a.listAttachments(db, ANA, PID);
    expect(rows.map((r) => r.name)).toEqual(["M-535-26-Ion-Popescu.pdf", "M-535-26-Ion-Popescu-2.pdf"]);
    expect(rows[0].path).toMatch(new RegExp(`^${PID}/[0-9a-f-]{36}-scanare-sedinta\\.pdf$`));
    expect(rows[0]).toMatchObject({ mime: "application/pdf", size: 4, uploaded_by: ANA.id });
    expect(files.keys()).toEqual(rows.map((r) => r.path));
  });

  it("jurnalizează ca triggerul: numărul petiției și numele fișierului", async () => {
    await a.uploadAttachment(db, memoryStore(), ANA, { petitionId: PID, kind: "petitie", file: pdf() });
    const [row] = await db.select().from(s.auditLog).where(eq(s.auditLog.entity, "petition_attachments"));
    expect(row).toMatchObject({ action: "INSERT", actor_id: ANA.id });
    expect(row.details).toEqual({ number: "M-535/26", name: "M-535-26-Ion-Popescu.pdf" });
  });

  it("dacă scrierea în D1 cade, obiectul urcat se șterge", async () => {
    const files = memoryStore();
    // Un admin fără profil: dreptul trece, dar `uploaded_by` n-are părinte,
    // deci inserarea în D1 cade pe cheia străină — după ce obiectul a urcat.
    const ghost = { ...ANA, id: "00000000-0000-4000-8000-0000000000ff" };
    const res = await a.uploadAttachment(db, files, { ...ghost, isAdmin: true }, {
      petitionId: PID,
      kind: "petitie",
      file: pdf(),
    });
    expect(res.error).toBeTruthy();
    expect(files.keys()).toEqual([]);
    expect(await db.select().from(s.petitionAttachments)).toEqual([]);
  });

  it("dacă R2 cade, nu rămâne niciun rând", async () => {
    const files = memoryStore({ failPut: true });
    await expect(
      a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: pdf() }),
    ).rejects.toThrow("R2 indisponibil");
    expect(await db.select().from(s.petitionAttachments)).toEqual([]);
  });
});

describe("fișierele: ștergerea", () => {
  it("doar cine poate modifica petiția; rândul, obiectul și jurnalul pleacă împreună", async () => {
    const files = memoryStore();
    await a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: pdf() });
    const [row] = await a.listAttachments(db, ANA, PID);
    expect(await a.deleteAttachment(db, files, BOB, row.id)).toEqual({
      error: "Fișier inexistent sau fără permisiune.",
    });
    expect(files.keys()).toHaveLength(1);
    expect(await a.deleteAttachment(db, files, ANA, row.id)).toEqual({ success: true });
    expect(files.keys()).toEqual([]);
    const audit = await db.select().from(s.auditLog).where(eq(s.auditLog.action, "DELETE"));
    expect(audit.map((r) => r.details)).toEqual([{ number: "M-535/26", name: row.name }]);
  });
});

describe("fișierele: descărcarea", () => {
  it("orice om conectat descarcă un fișier care are rând; fără sesiune, nu", async () => {
    const files = memoryStore();
    await a.uploadAttachment(db, files, ANA, { petitionId: PID, kind: "petitie", file: pdf() });
    const [row] = await a.listAttachments(db, ANA, PID);
    const found = await a.attachmentForDownload(db, files, BOB, row.path);
    expect(found?.row.id).toBe(row.id);
    expect(found?.object.size).toBe(4);
    expect(await a.attachmentForDownload(db, files, null, row.path)).toBeNull();
  });

  it("refuză o cheie din bucket care nu are rând în tabel", async () => {
    const files = memoryStore();
    await files.put(`${PID}/ascuns.pdf`, new Uint8Array([1, 2]));
    expect(await a.attachmentForDownload(db, files, ANA, `${PID}/ascuns.pdf`)).toBeNull();
  });

  it("lista e goală fără sesiune", async () => {
    await a.uploadAttachment(db, memoryStore(), ANA, { petitionId: PID, kind: "petitie", file: pdf() });
    expect(await a.listAttachments(db, null, PID)).toEqual([]);
  });
});
