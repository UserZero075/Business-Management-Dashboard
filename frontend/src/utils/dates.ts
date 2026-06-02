const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

export function todayBrazilDateInput(): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function toDateInputValue(value?: string | null): string {
  if (!value) return '';

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

export function formatBrazilDate(value?: string | null, fallback = '—'): string {
  const dateInput = toDateInputValue(value);
  if (!dateInput) return fallback;

  const [year, month, day] = dateInput.split('-');
  return `${day}/${month}/${year}`;
}

function toUtcNoon(dateInput: string): Date {
  const [year, month, day] = dateInput.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function toIsoDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysBrazil(dateInput: string, days: number): string {
  const date = toUtcNoon(dateInput);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDateInput(date);
}

export function advanceBrazilDateInput(dateInput: string, period: 'quinzenal' | 'mensal' | 'anual'): string {
  const date = toUtcNoon(dateInput);

  if (period === 'quinzenal') date.setUTCDate(date.getUTCDate() + 15);
  else if (period === 'mensal') date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);

  return toIsoDateInput(date);
}

export function monthsBetweenDateInputs(startValue?: string | null, endValue?: string | null): number | null {
  const start = toDateInputValue(startValue);
  const end = toDateInputValue(endValue);
  if (!start || !end) return null;

  const averageMonthMs = 1000 * 60 * 60 * 24 * 30.4375;
  const months = Math.round(Math.abs(toUtcNoon(end).getTime() - toUtcNoon(start).getTime()) / averageMonthMs);

  return months > 0 ? months : null;
}
