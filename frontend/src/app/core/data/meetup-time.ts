/** Convierte una hora de 24 horas ("15:30") al formato de 12 horas ("3:30 p. m."). */
export function formatMeetupTime(time: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!match) return time ?? '';
  const hours = Number(match[1]);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${match[2]} ${hours < 12 ? 'a. m.' : 'p. m.'}`;
}
