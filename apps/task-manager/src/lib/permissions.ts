export function canEditComment(userId: string, comment: { author_id: string }): boolean {
  return userId === comment.author_id;
}

export function canDeleteComment(
  userId: string,
  isAdmin: boolean,
  comment: { author_id: string },
): boolean {
  return isAdmin || userId === comment.author_id;
}

export function canDeleteTask(
  userId: string,
  isAdmin: boolean,
  task: { created_by: string },
): boolean {
  return isAdmin || userId === task.created_by;
}

export function canEditTask(
  userId: string,
  isAdmin: boolean,
  task: { created_by: string; assignee_id: string | null },
): boolean {
  return isAdmin || userId === task.created_by || userId === task.assignee_id;
}

// Finalizarea (marcarea ca „done") e permisă pentru sarcina proprie
// (creată de user sau atribuită lui) sau pentru admin pe oricare.
export function canFinalizeTask(
  userId: string,
  isAdmin: boolean,
  task: { created_by: string; assignee_id: string | null },
): boolean {
  return isAdmin || userId === task.created_by || userId === task.assignee_id;
}

export function canReassignTask(isAdmin: boolean): boolean {
  return isAdmin;
}

// Oglindesc RLS din 0012_petitions.sql:
// update → admin/creator/responsabil, delete → admin/creator.
export function canEditPetition(
  userId: string,
  isAdmin: boolean,
  petition: { created_by: string; assignee_id: string | null },
): boolean {
  return isAdmin || userId === petition.created_by || userId === petition.assignee_id;
}

export function canDeletePetition(
  userId: string,
  isAdmin: boolean,
  petition: { created_by: string },
): boolean {
  return isAdmin || userId === petition.created_by;
}
