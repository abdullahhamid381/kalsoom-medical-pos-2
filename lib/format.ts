/** Formats a 24-hour 'HH:MM' time string (as stored in the DB) as 12-hour with AM/PM, e.g. '16:03' -> '4:03 PM'. */
export function formatTime12h(t: string): string {
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const hour = Number(m[1]);
  const minute = m[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}
