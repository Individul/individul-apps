/**
 * Cine are voie la ce — regulile RLS din `supabase/migrations`, mutate în cod.
 *
 * În Supabase, baza refuza singură o scriere fără drept, oricât de neatent ar
 * fi fost codul. Pe D1 nu există o asemenea poartă: dreptul îl verifică
 * aplicația, înainte de fiecare scriere, cu funcțiile de aici. Fiecare poartă
 * numele regulii pe care o înlocuiește și spune același lucru, nici mai mult,
 * nici mai puțin — și are teste pentru omul care are dreptul și pentru cel care
 * nu-l are.
 *
 * Unde regula avea `using` și `with check` (actualizări), există două funcții:
 * una pentru rândul de dinainte („îl poți atinge?") și una pentru rândul de
 * după („rezultatul e încă al tău?"). Postgres le verifica pe amândouă.
 *
 * Citirile: aproape totul e „orice om conectat citește". Excepțiile sunt aici
 * (`canReadAuditLog`, `canReadBackupRuns`, notificările), iar interogările care
 * le privesc filtrează explicit — o interogare fără filtru nu mai e oprită de
 * nimeni.
 */

import {
  canDeleteComment,
  canDeletePetition,
  canDeleteTask,
  canEditComment,
  canEditPetition,
  canEditTask,
} from "./permissions";

/** Cine face acțiunea. Fără `Actor` nu se scrie nimic: nu există „anonim". */
export interface Actor {
  id: string;
  /** `profiles.full_name`, pentru jurnal (`actor_name`). */
  name: string | null;
  isAdmin: boolean;
}

/** Mesajul pentru o acțiune făcută fără sesiune. */
export const NEAUTENTIFICAT = "Neautentificat.";

type TaskRow = { created_by: string; assignee_id: string | null };
type PetitionRow = { created_by: string; assignee_id: string | null };

/* ---------------------------------------------------------- profiles (0002) */

/** „profiles update": propriul profil, sau adminul. */
export const canUpdateProfile = (me: Actor, profileId: string) =>
  me.isAdmin || me.id === profileId;

/** Garda `profiles_role_guard`: doar adminul schimbă un rol. */
export const canChangeRole = (me: Actor) => me.isAdmin;

/** Conturile se creează și se șterg doar din Administrare. */
export const canManageUsers = (me: Actor) => me.isAdmin;

/* ---------------------------------------------------------- tasks (0002) */

/** „tasks insert": adminul; altfel doar ale tale, pe tine sau fără responsabil. */
export const canInsertTask = (me: Actor, row: TaskRow) =>
  me.isAdmin ||
  (row.created_by === me.id && (row.assignee_id === me.id || row.assignee_id === null));

/** „tasks update" (using și with check): adminul, autorul sau responsabilul. */
export const canUpdateTask = (me: Actor, row: TaskRow) => canEditTask(me.id, me.isAdmin, row);

/** Garda `tasks_reassign_guard`: doar adminul schimbă responsabilul. */
export const canReassign = (me: Actor) => me.isAdmin;

/** „tasks delete": adminul sau autorul. */
export const canDeleteTaskRow = (me: Actor, row: { created_by: string }) =>
  canDeleteTask(me.id, me.isAdmin, row);

/* ---------------------------------------------------------- tags (0004) */

/** „tags insert/update/delete admin". */
export const canWriteTags = (me: Actor) => me.isAdmin;

/* ---------------------------------------------------------- comments (0001, 0006) */

/** „comments insert own or admin". */
export const canInsertComment = (me: Actor, row: { author_id: string }) =>
  me.isAdmin || me.id === row.author_id;

/** „comments update own" — doar autorul, nici adminul. */
export const canUpdateComment = (me: Actor, row: { author_id: string }) =>
  canEditComment(me.id, row);

/** „comments delete": adminul sau autorul. */
export const canDeleteCommentRow = (me: Actor, row: { author_id: string }) =>
  canDeleteComment(me.id, me.isAdmin, row);

/* ---------------------------------------------------------- subtasks (0010) */

/** „subtasks write": cine poate modifica sarcina îi poate modifica și pașii. */
export const canWriteSubtasks = (me: Actor, task: TaskRow) => canEditTask(me.id, me.isAdmin, task);

/* ---------------------------------------------------------- petitions (0012, 0013) */

/** „petitions insert": adminul sau propria petiție. */
export const canInsertPetition = (me: Actor, row: { created_by: string }) =>
  me.isAdmin || row.created_by === me.id;

/** „petitions update" (using și with check). */
export const canUpdatePetition = (me: Actor, row: PetitionRow) =>
  canEditPetition(me.id, me.isAdmin, row);

/** „petitions delete": adminul sau autorul. */
export const canDeletePetitionRow = (me: Actor, row: { created_by: string }) =>
  canDeletePetition(me.id, me.isAdmin, row);

/** `can_modify_petition`: fișierele urmează dreptul asupra petiției. */
export const canModifyPetitionFiles = (me: Actor, petition: PetitionRow) =>
  canEditPetition(me.id, me.isAdmin, petition);

/* ---------------------------------------------------------- registrele (0018–0031) */

/**
 * Ședințe, transferuri, planificarea transferurilor, inculpați, contravenienți,
 * eliberări: orice om conectat citește, adaugă și modifică; doar adminul
 * șterge. O singură funcție, fiindcă regula e literal aceeași în toate.
 */
export const canWriteRegistry = (_me: Actor) => true;
export const canDeleteRegistry = (me: Actor) => me.isAdmin;

/* ---------------------------------------------------------- obligations (0023) */

/** „completions insert/delete": oricine conectat bifează și debifează. */
export const canWriteCompletions = (_me: Actor) => true;

/* ---------------------------------------------------------- evidența */

/** „audit select admin". */
export const canReadAuditLog = (me: Actor) => me.isAdmin;

/** „backup_runs select". */
export const canReadBackupRuns = (me: Actor) => me.isAdmin;

/** Copia manuală și restaurarea: doar adminul. */
export const canBackup = (me: Actor) => me.isAdmin;
