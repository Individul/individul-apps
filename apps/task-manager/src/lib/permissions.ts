export function canEditComment(userId: string, comment: { author_id: string }): boolean {
  return userId === comment.author_id;
}
