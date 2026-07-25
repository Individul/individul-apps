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

export function canReassignTask(isAdmin: boolean): boolean {
  return isAdmin;
}
