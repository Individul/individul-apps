"use server";

import { eq } from "drizzle-orm";

import { getActor } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import {
  MIN_QUERY,
  search,
  type ContravenerRow,
  type DefendantRow,
  type PetitionRow,
  type PlanRow,
  type SearchData,
  type SearchGroup,
  type TaskRow,
} from "@/lib/search";

/** Un registru care nu poate fi citit nu oprește căutarea în celelalte. */
const orEmpty = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);

/**
 * Caută în toate registrele deodată.
 *
 * Se cer doar coloanele în care se caută sau care se arată — nu rândurile
 * întregi. Descrierile petițiilor, observațiile, fișierele atașate ar traversa
 * rețeaua la fiecare tastă ca să fie aruncate.
 *
 * Fără sesiune nu se caută nimic: toate registrele de aici erau „orice om
 * conectat citește", deci cine e conectat vede exact ce vede și în module.
 */
export async function searchAll(query: string): Promise<SearchGroup[]> {
  if (query.trim().length < MIN_QUERY) return [];
  if (!(await getActor())) return [];
  const db = getDb();

  const [tasks, links, petitions, plans, defendants, contraveners, profiles] = await Promise.all([
    orEmpty(
      db
        .select({
          id: s.tasks.id,
          title: s.tasks.title,
          description: s.tasks.description,
          status: s.tasks.status,
          assignee_id: s.tasks.assignee_id,
          appealed_csj: s.tasks.appealed_csj,
        })
        .from(s.tasks),
    ),
    // Eticheta e esența sarcinii, deci se arată și se caută.
    orEmpty(
      db
        .select({ task_id: s.taskTags.task_id, id: s.tags.id, name: s.tags.name, color: s.tags.color })
        .from(s.taskTags)
        .innerJoin(s.tags, eq(s.tags.id, s.taskTags.tag_id)),
    ),
    orEmpty(
      db
        .select({
          id: s.petitions.id,
          number: s.petitions.number,
          petitioner: s.petitions.petitioner,
          subject: s.petitions.subject,
          status: s.petitions.status,
          assignee_id: s.petitions.assignee_id,
        })
        .from(s.petitions),
    ),
    orEmpty(
      db
        .select({
          id: s.transferPlans.id,
          last_name: s.transferPlans.last_name,
          first_name: s.transferPlans.first_name,
          court: s.transferPlans.court,
          institution: s.transferPlans.institution,
          note: s.transferPlans.note,
          done: s.transferPlans.done,
        })
        .from(s.transferPlans),
    ),
    orEmpty(
      db
        .select({
          id: s.defendants.id,
          last_name: s.defendants.last_name,
          first_name: s.defendants.first_name,
          court: s.defendants.court,
          case_number: s.defendants.case_number,
          status: s.defendants.status,
          preventive_measure: s.defendants.preventive_measure,
        })
        .from(s.defendants),
    ),
    orEmpty(
      db
        .select({
          id: s.contraveners.id,
          last_name: s.contraveners.last_name,
          first_name: s.contraveners.first_name,
          patronymic: s.contraveners.patronymic,
          decision_date: s.contraveners.decision_date,
          arrest_days: s.contraveners.arrest_days,
          final_date: s.contraveners.final_date,
          executed_on: s.contraveners.executed_on,
          informed_at: s.contraveners.informed_at,
        })
        .from(s.contraveners),
    ),
    // Fără profiluri, rezultatele apar oricum — doar fără nume la responsabil.
    orEmpty(db.select({ id: s.profiles.id, full_name: s.profiles.full_name }).from(s.profiles)),
  ]);

  const tagsOf = new Map<string, { id: string; name: string; color: string }[]>();
  for (const { task_id, ...tag } of links) tagsOf.set(task_id, [...(tagsOf.get(task_id) ?? []), tag]);

  return search(query, {
    tasks: tasks.map((t) => ({ ...t, tags: tagsOf.get(t.id) ?? [] })) as unknown as TaskRow[],
    petitions: petitions as unknown as PetitionRow[],
    plans: plans as unknown as PlanRow[],
    defendants: defendants as unknown as DefendantRow[],
    contraveners: contraveners as unknown as ContravenerRow[],
    profiles: profiles as SearchData["profiles"],
  });
}
