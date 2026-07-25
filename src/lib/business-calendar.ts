function formatInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfDayInUTC(dateStr: string, tz: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);

  let lo = Date.UTC(y, m - 1, d - 1, 12, 0, 0, 0);
  let hi = Date.UTC(y, m - 1, d, 12, 0, 0, 0);

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (formatInTz(new Date(mid), tz) < dateStr) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
}

export class BusinessCalendar {
  constructor(private readonly timezone: string) {}

  /** YYYY-MM-DD in the configured timezone */
  today(): string {
    return formatInTz(new Date(), this.timezone);
  }

  /** YYYY-MM-DD for a UTC Date in the configured timezone */
  dateStr(date: Date): string {
    return formatInTz(date, this.timezone);
  }

  /** Is dueAt on the same calendar day as today? */
  isSameBusinessDay(dueAt: Date): boolean {
    return this.dateStr(dueAt) === this.today();
  }

  /** Is dueAt on a calendar day strictly before today? */
  isBeforeBusinessDay(dueAt: Date): boolean {
    return this.dateStr(dueAt) < this.today();
  }

  /** Is dueAt on a calendar day strictly after today? */
  isAfterBusinessDay(dueAt: Date): boolean {
    return this.dateStr(dueAt) > this.today();
  }

  /** Should an expectedShipDate create a SCHEDULED task? */
  shouldSchedule(expectedShipDate: Date): boolean {
    return this.isAfterBusinessDay(expectedShipDate);
  }

  /** Should a SCHEDULED task appear in Today's Tasks? */
  isActive(dueAt: Date): boolean {
    return !this.isAfterBusinessDay(dueAt);
  }

  /** Compute the display bucket from a dueAt date */
  bucket(dueAt: Date): "today" | "tomorrow" | "upcoming" {
    if (!this.isAfterBusinessDay(dueAt)) return "today";

    const [y, m, d] = this.today().split("-").map(Number);
    const tomorrowStart = startOfDayInUTC(
      `${y}-${String(m).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`,
      this.timezone,
    );
    const tomorrow = formatInTz(new Date(tomorrowStart), this.timezone);

    if (this.dateStr(dueAt) === tomorrow) return "tomorrow";
    return "upcoming";
  }

  /** UTC Date for the start of tomorrow in the configured timezone */
  startOfTomorrowUTC(): Date {
    const today = this.today();
    const [y, m, d] = today.split("-").map(Number);
    const tomorrow = `${y}-${String(m).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
    return new Date(startOfDayInUTC(tomorrow, this.timezone));
  }

  /** UTC Date for the start of today in the configured timezone */
  startOfTodayUTC(): Date {
    return new Date(startOfDayInUTC(this.today(), this.timezone));
  }
}
