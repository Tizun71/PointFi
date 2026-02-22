export function getDateNMonthsAgo(n: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - n);
  return date.toISOString().split('T')[0];
}

export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function addVariance(value: number, percentage: number = 0.05): number {
  return 1 + (Math.random() - 0.5) * percentage;
}
