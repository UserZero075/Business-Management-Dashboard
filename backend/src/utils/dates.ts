const BRAZIL_UTC_OFFSET_HOURS = 3;
const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

export function parseBrazilDateOnly(value?: string | null): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(value);

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  return new Date(Date.UTC(year, month, day, BRAZIL_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function parseBrazilDateOnlyOrUndefined(value?: string | null): Date | undefined {
  return parseBrazilDateOnly(value) ?? undefined;
}

export function todayBrazilDateOnly(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRAZIL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const brazilDate = `${values.year}-${values.month}-${values.day}`;

  return parseBrazilDateOnly(brazilDate) || now;
}

export function brazilDateRange(startDate?: string, endDate?: string): { gte?: Date; lt?: Date } | undefined {
  const range: { gte?: Date; lt?: Date } = {};

  const start = parseBrazilDateOnly(startDate);
  if (start) range.gte = start;

  const end = parseBrazilDateOnly(endDate);
  if (end) {
    const nextDay = new Date(end);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    range.lt = nextDay;
  }

  return range.gte || range.lt ? range : undefined;
}
