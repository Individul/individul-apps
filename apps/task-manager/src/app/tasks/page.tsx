import { redirect } from "next/navigation";

// Lista sarcinilor s-a mutat la rădăcină (/). Păstrăm /tasks ca redirect pentru
// linkuri și bookmark-uri vechi.
export default function TasksRedirect() {
  redirect("/");
}
