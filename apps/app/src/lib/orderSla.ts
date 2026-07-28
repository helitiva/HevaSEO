// Turn a package SLA string into a concrete turnaround. Handles "~2 days", "2–3 days" / "2-3 days",
// "7–10 days", "10 days", "2–3 weeks", "~3 weeks". Returns the upper bound in days, or null when the
// estimate isn't concrete (e.g. "By scope").
export function slaToDays(sla: string | null | undefined): number | null {
  if (!sla) return null;
  const nums = sla.match(/\d+/g);
  if (!nums?.length) return null;
  const max = Math.max(...nums.map(Number));
  return /week/i.test(sla) ? max * 7 : max;
}

/** ISO deadline = now + SLA days, or null when the SLA has no concrete estimate. */
export function deadlineFromSla(sla: string | null | undefined, from: Date = new Date()): string | null {
  const days = slaToDays(sla);
  if (days == null) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
