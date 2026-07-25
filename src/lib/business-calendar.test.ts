import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BusinessCalendar } from "./business-calendar";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to create a UTC Date at midnight of a given ISO date string
function utcDate(iso: string): Date {
  return new Date(iso + "T00:00:00.000Z");
}

// Helper to set the system time to a specific UTC instant
function setTime(iso: string, ms = 0) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCMilliseconds(ms);
  vi.setSystemTime(d);
}

describe("BusinessCalendar", () => {
  describe("Africa/Cairo (UTC+2, DST UTC+3 in summer)", () => {
    // July 18, 2026 at 01:37 Cairo time = July 17, 2026 22:37 UTC
    it("handles the bug scenario: July 18 01:37 Cairo, dueAt=midnight UTC", () => {
      vi.setSystemTime(new Date("2026-07-17T22:37:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      const dueAt = utcDate("2026-07-18");

      expect(cal.today()).toBe("2026-07-18");
      expect(cal.dateStr(dueAt)).toBe("2026-07-18");
      expect(cal.isSameBusinessDay(dueAt)).toBe(true);
      expect(cal.isBeforeBusinessDay(dueAt)).toBe(false);
      expect(cal.isAfterBusinessDay(dueAt)).toBe(false);
      expect(cal.isActive(dueAt)).toBe(true);
      expect(cal.bucket(dueAt)).toBe("today");
    });

    it("correctly identifies tomorrow", () => {
      vi.setSystemTime(new Date("2026-07-17T22:37:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      const tomorrowDue = utcDate("2026-07-19");

      expect(cal.dateStr(tomorrowDue)).toBe("2026-07-19");
      expect(cal.isAfterBusinessDay(tomorrowDue)).toBe(true);
      expect(cal.bucket(tomorrowDue)).toBe("tomorrow");
    });

    it("correctly buckets upcoming tasks", () => {
      vi.setSystemTime(new Date("2026-07-17T22:37:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      const futureDue = utcDate("2026-08-01");

      expect(cal.dateStr(futureDue)).toBe("2026-08-01");
      expect(cal.isAfterBusinessDay(futureDue)).toBe(true);
      expect(cal.bucket(futureDue)).toBe("upcoming");
    });

    it("shouldSchedule returns false for today", () => {
      vi.setSystemTime(new Date("2026-07-17T22:37:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      expect(cal.shouldSchedule(utcDate("2026-07-18"))).toBe(false);
    });

    it("shouldSchedule returns true for tomorrow", () => {
      vi.setSystemTime(new Date("2026-07-17T22:37:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      expect(cal.shouldSchedule(utcDate("2026-07-19"))).toBe(true);
    });

    it("startOfTomorrowUTC returns correct UTC boundary", () => {
      vi.setSystemTime(new Date("2026-07-17T22:37:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      // July 19 00:00 Cairo = July 18 21:00 UTC (Cairo summer = UTC+3)
      const boundary = cal.startOfTomorrowUTC();
      expect(boundary.toISOString()).toBe("2026-07-18T21:00:00.000Z");
    });

    it("isActive returns true for a past-due task", () => {
      vi.setSystemTime(new Date("2026-07-17T22:37:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      const pastDue = utcDate("2026-07-17");
      expect(cal.isActive(pastDue)).toBe(true);
      expect(cal.bucket(pastDue)).toBe("today");
      expect(cal.isBeforeBusinessDay(pastDue)).toBe(true);
    });
  });

  describe("Asia/Kuwait (UTC+3, no DST)", () => {
    it("handles July 18 at 01:00 Kuwait time = July 17 22:00 UTC", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("Asia/Kuwait");
      const dueAt = utcDate("2026-07-18");

      expect(cal.today()).toBe("2026-07-18");
      expect(cal.isActive(dueAt)).toBe(true);
      expect(cal.bucket(dueAt)).toBe("today");
    });

    it("startOfTomorrowUTC for July 18 Kuwait = July 18 21:00 UTC", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("Asia/Kuwait");
      // July 19 00:00 Kuwait = July 18 21:00 UTC (Kuwait is UTC+3)
      const boundary = cal.startOfTomorrowUTC();
      expect(boundary.toISOString()).toBe("2026-07-18T21:00:00.000Z");
    });

    it("correctly handles month rollover in date math", () => {
      vi.setSystemTime(new Date("2026-01-31T21:00:00.000Z"));
      const cal = new BusinessCalendar("Asia/Kuwait");
      expect(cal.today()).toBe("2026-02-01");
      const boundary = cal.startOfTomorrowUTC();
      // Feb 2 00:00 Kuwait = Feb 1 21:00 UTC
      expect(boundary.toISOString()).toBe("2026-02-01T21:00:00.000Z");
    });
  });

  describe("UTC timezone", () => {
    it("handles July 18 at 01:00 UTC", () => {
      vi.setSystemTime(new Date("2026-07-18T01:00:00.000Z"));
      const cal = new BusinessCalendar("UTC");
      const dueAt = utcDate("2026-07-18");

      expect(cal.today()).toBe("2026-07-18");
      expect(cal.isActive(dueAt)).toBe(true);
      expect(cal.bucket(dueAt)).toBe("today");
    });

    it("startOfTomorrowUTC for UTC is always midnight", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("UTC");
      // July 18 00:00 UTC = midnight
      const boundary = cal.startOfTomorrowUTC();
      expect(boundary.toISOString()).toBe("2026-07-18T00:00:00.000Z");
    });

    it("correctly identifies tomorrow in UTC", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("UTC");
      const tomorrowDue = utcDate("2026-07-18");

      expect(cal.dateStr(tomorrowDue)).toBe("2026-07-18");
      expect(cal.today()).toBe("2026-07-17");
      expect(cal.isAfterBusinessDay(tomorrowDue)).toBe(true);
      expect(cal.bucket(tomorrowDue)).toBe("tomorrow");
    });
  });

  describe("America/New_York (UTC-5, DST UTC-4 in summer)", () => {
    it("handles July 18 at 01:00 NY time = July 18 05:00 UTC", () => {
      vi.setSystemTime(new Date("2026-07-18T05:00:00.000Z"));
      const cal = new BusinessCalendar("America/New_York");
      const dueAt = utcDate("2026-07-18");

      expect(cal.today()).toBe("2026-07-18");
      expect(cal.isActive(dueAt)).toBe(true);
      expect(cal.bucket(dueAt)).toBe("today");
    });

    it("handles July 17 at 22:00 UTC (still July 17 in NY)", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("America/New_York");
      // 22:00 UTC = 18:00 NY (EDT, UTC-4)
      expect(cal.today()).toBe("2026-07-17");
    });

    it("startOfTomorrowUTC for NY", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("America/New_York");
      // July 18 00:00 NY (EDT) = July 18 04:00 UTC
      const boundary = cal.startOfTomorrowUTC();
      expect(boundary.toISOString()).toBe("2026-07-18T04:00:00.000Z");
    });
  });

  describe("Midnight edge cases", () => {
    it("exactly at midnight Cairo: T00:00:00.000 Cairo = July 17 21:00 UTC", () => {
      vi.setSystemTime(new Date("2026-07-17T21:00:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      expect(cal.today()).toBe("2026-07-18");
      expect(cal.isActive(utcDate("2026-07-18"))).toBe(true);
      expect(cal.isAfterBusinessDay(utcDate("2026-07-18"))).toBe(false);
    });

    it("one millisecond before midnight Cairo", () => {
      vi.setSystemTime(new Date("2026-07-17T20:59:59.999Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      expect(cal.today()).toBe("2026-07-17");
    });

    it("one millisecond after midnight Cairo", () => {
      vi.setSystemTime(new Date("2026-07-17T21:00:00.001Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      expect(cal.today()).toBe("2026-07-18");
    });

    it("exactly at midnight UTC", () => {
      vi.setSystemTime(new Date("2026-07-18T00:00:00.000Z"));
      const cal = new BusinessCalendar("UTC");
      expect(cal.today()).toBe("2026-07-18");
    });

    it("one second before midnight UTC", () => {
      vi.setSystemTime(new Date("2026-07-17T23:59:59.000Z"));
      const cal = new BusinessCalendar("UTC");
      expect(cal.today()).toBe("2026-07-17");
    });
  });

  describe("Cross-timezone comparisons", () => {
    it("a task due next month appears in all timezones as upcoming", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const dueAt = utcDate("2026-08-15");

      for (const tz of ["Africa/Cairo", "Asia/Kuwait", "UTC", "America/New_York"]) {
        const cal = new BusinessCalendar(tz);
        expect(cal.bucket(dueAt)).toBe("upcoming");
      }
    });

    it("a task due yesterday is active in all timezones", () => {
      vi.setSystemTime(new Date("2026-07-18T12:00:00.000Z"));
      const dueAt = utcDate("2026-07-17");

      for (const tz of ["Africa/Cairo", "Asia/Kuwait", "UTC", "America/New_York"]) {
        const cal = new BusinessCalendar(tz);
        expect(cal.isActive(dueAt)).toBe(true);
        expect(cal.bucket(dueAt)).toBe("today");
      }
    });
  });

  describe("startOfDayInUTC boundary", () => {
    it("starts before startOfTomorrowUTC", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("Africa/Cairo");
      const todayStart = cal.startOfTodayUTC();
      const tomorrowStart = cal.startOfTomorrowUTC();
      expect(todayStart.getTime()).toBeLessThan(tomorrowStart.getTime());
    });

    it("boundary is 24 hours apart", () => {
      vi.setSystemTime(new Date("2026-07-17T22:00:00.000Z"));
      const cal = new BusinessCalendar("Asia/Kuwait");
      const a = cal.startOfTodayUTC().getTime();
      const b = cal.startOfTomorrowUTC().getTime();
      expect(b - a).toBe(24 * 60 * 60 * 1000);
    });
  });
});
