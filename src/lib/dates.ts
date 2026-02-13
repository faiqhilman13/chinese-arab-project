export function startOfUtcDay(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function addUtcDays(input: Date, days: number): Date {
  return new Date(input.getTime() + days * 24 * 60 * 60 * 1000);
}

export function diffUtcDays(a: Date, b: Date): number {
  const aStart = startOfUtcDay(a).getTime();
  const bStart = startOfUtcDay(b).getTime();
  return Math.floor((aStart - bStart) / (24 * 60 * 60 * 1000));
}

export function startOfUtcMonth(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1));
}
