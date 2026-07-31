import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, DUMP_VERSION } from "./backup-dump";

/**
 * Lista tabelelor e singurul loc din care se citește ce intră în copie. Bugul
 * care a dus la ea a fost tocmai o listă uitată: butonul de descărcare salva
 * cinci tabele din cincisprezece, fiindcă lista lui era o copie pe care nimeni
 * n-a mai actualizat-o. Testele de aici păzesc lista rămasă.
 */
describe("lista tabelelor din copie", () => {
  const names = BACKUP_TABLES.map((t) => t.name);

  it("le are pe toate cincisprezece, fără repetiții", () => {
    expect(names).toHaveLength(15);
    expect(new Set(names).size).toBe(15);
  });

  it("scrie formatul complet, nu pe cel vechi", () => {
    // Versiunea 1 era fișierul cu cinci tabele. Cine dă peste un fișier peste
    // ani deosebește copia întreagă de cea parțială doar după numărul ăsta.
    expect(DUMP_VERSION).toBe(2);
  });

  it("fiecare tabel se termină cu o coloană unică", () => {
    // Fără o ordine totală, paginarea peste rânduri egale poate sări rânduri
    // sau le poate lua de două ori — pierderea tăcută pe care copia există
    // s-o prevină. `created_at` singur nu ajunge: două rânduri scrise în
    // aceeași tranzacție îl au identic.
    for (const table of BACKUP_TABLES) {
      if (table.name === "task_tags") {
        // Singurul tabel fără `id`: cheia primară e perechea.
        expect(table.order).toEqual(["task_id", "tag_id"]);
        continue;
      }
      const last = table.order[table.order.length - 1];
      expect(last, `„${table.name}" nu se termină cu o coloană unică`).toBe("id");
    }
  });

  it("părintele vine înaintea copilului, pentru restaurare", () => {
    // Perechile sunt citite din migrări (0001, 0008, 0010, 0012, 0013, 0015,
    // 0016), nu din lista testată — altfel testul ar confirma doar că lista e
    // egală cu ea însăși. La restaurare fișierul se parcurge de sus în jos,
    // deci un copil pus prea sus ar cere rânduri care încă nu există.
    const foreignKeys: ReadonlyArray<readonly [string, string]> = [
      ["tasks", "profiles"],
      ["subtasks", "tasks"],
      ["comments", "tasks"],
      ["comments", "profiles"],
      ["task_tags", "tasks"],
      ["task_tags", "tags"],
      ["petitions", "profiles"],
      ["petition_attachments", "petitions"],
      ["petition_attachments", "profiles"],
      ["hearings", "profiles"],
      ["transfers", "profiles"],
      ["transfer_plans", "profiles"],
      ["stat_reports", "profiles"],
      ["stat_values", "stat_reports"],
      ["notifications", "profiles"],
      ["notifications", "tasks"],
      ["notifications", "petitions"],
    ];

    for (const [child, parent] of foreignKeys) {
      const childAt = names.indexOf(child);
      const parentAt = names.indexOf(parent);
      expect(childAt, `„${child}" lipsește din copie`).toBeGreaterThanOrEqual(0);
      expect(parentAt, `„${parent}" lipsește din copie`).toBeGreaterThanOrEqual(0);
      expect(childAt, `„${child}" trebuie să vină după „${parent}"`).toBeGreaterThan(parentAt);
    }
  });

  it("modulele apărute după butonul vechi sunt în listă", () => {
    // Bugul reparat: petițiile, ședințele, transferurile și statisticile
    // existau de un an în aplicație și lipseau din backup.
    expect(names).toEqual(
      expect.arrayContaining([
        "petitions",
        "petition_attachments",
        "hearings",
        "transfers",
        "transfer_plans",
        "stat_reports",
        "stat_values",
        "subtasks",
        "notifications",
        "audit_log",
      ]),
    );
  });
});
