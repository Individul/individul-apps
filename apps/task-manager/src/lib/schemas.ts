import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "Titlul e obligatoriu.").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  status: z.enum(["todo", "in_progress", "waiting", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  due_date: z.string().optional().or(z.literal("")), // ISO date string yyyy-mm-dd or ""
  assignee_id: z.string().uuid().optional().or(z.literal("")),
  // Lipsa înseamnă „nu": formularele și apelurile de dinaintea câmpului nu-l
  // trimit, iar o salvare a lor n-are voie să ceară câmpul ca obligatoriu.
  appealed_csj: z.boolean().optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;
