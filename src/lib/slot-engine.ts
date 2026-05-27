/**
 * AegisHealth Slot Engine
 * Pure TypeScript slot generation from doctor schedules.
 * No external dependencies — deterministic and testable.
 */

export interface DoctorSchedule {
  workingDays: number[];   // 0 = Sunday … 6 = Saturday
  startTime: string;       // "HH:MM" 24-hour
  endTime: string;         // "HH:MM" 24-hour
  slotDurationMinutes: number;
  breakStart?: string;     // "HH:MM" optional break start
  breakEnd?: string;       // "HH:MM" optional break end
  maxSlots?: number;       // Optional hard cap
}

export type SlotStatus = "available" | "locked" | "booked" | "blocked";

export interface GeneratedSlot {
  id: string;              // e.g. "09:00"
  time: string;            // "09:00" (24-hour)
  display: string;         // "9:00 AM"
  endTime: string;         // "09:30"
  endDisplay: string;      // "9:30 AM"
  status: SlotStatus;
}

/* ─── Default schedule used when no schedule is configured ─── */
export const DEFAULT_SCHEDULE: DoctorSchedule = {
  workingDays: [1, 2, 3, 4, 5],  // Mon–Fri
  startTime: "09:00",
  endTime: "17:00",
  slotDurationMinutes: 30,
  breakStart: "13:00",
  breakEnd: "14:00",
};

/* ─── Parse "HH:MM" into total minutes from midnight ─── */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/* ─── Format total minutes from midnight to "HH:MM" ─── */
function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ─── Format "HH:MM" to "h:MM AM/PM" ─── */
export function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Generate all possible time slots for a given date from a schedule.
 * Does NOT apply booking status — that's overlaid by the API.
 */
export function generateDaySlots(schedule: DoctorSchedule, date: Date): GeneratedSlot[] {
  const dayOfWeek = date.getDay();

  // Check if the doctor works on this day
  if (!schedule.workingDays.includes(dayOfWeek)) return [];

  const start = toMinutes(schedule.startTime);
  const end = toMinutes(schedule.endTime);
  const dur = schedule.slotDurationMinutes;
  const breakStart = schedule.breakStart ? toMinutes(schedule.breakStart) : null;
  const breakEnd = schedule.breakEnd ? toMinutes(schedule.breakEnd) : null;
  const maxSlots = schedule.maxSlots ?? 999;

  const slots: GeneratedSlot[] = [];
  let cursor = start;

  while (cursor + dur <= end && slots.length < maxSlots) {
    const slotEnd = cursor + dur;

    // Skip slots that overlap with the break
    const overlapBreak =
      breakStart !== null &&
      breakEnd !== null &&
      cursor < breakEnd &&
      slotEnd > breakStart;

    if (!overlapBreak) {
      const timeStr = fromMinutes(cursor);
      const endTimeStr = fromMinutes(slotEnd);
      slots.push({
        id: timeStr,
        time: timeStr,
        display: formatTimeDisplay(timeStr),
        endTime: endTimeStr,
        endDisplay: formatTimeDisplay(endTimeStr),
        status: "available",
      });
    }

    cursor += dur;
  }

  return slots;
}

/**
 * Merge RTD booking status onto generated slots.
 * `bookedSlots` is a Record<slotId, { status, lockedAt? }> from Firebase.
 */
export function applyBookingStatus(
  slots: GeneratedSlot[],
  bookedSlots: Record<string, { status: SlotStatus; lockedAt?: number }>
): GeneratedSlot[] {
  const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();

  return slots.map((slot) => {
    const booking = bookedSlots[slot.id];
    if (!booking) return slot;

    // Auto-release stale locks
    if (
      booking.status === "locked" &&
      booking.lockedAt &&
      now - booking.lockedAt > LOCK_TTL_MS
    ) {
      return { ...slot, status: "available" };
    }

    return { ...slot, status: booking.status };
  });
}

/**
 * Get a date string key "YYYY-MM-DD" from a Date object (local time).
 */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Generate the next N working days from today (inclusive).
 */
export function getWorkingDays(schedule: DoctorSchedule, count = 7): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (days.length < count) {
    if (schedule.workingDays.includes(cursor.getDay())) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/**
 * Human-readable label for a date (Today, Tomorrow, Mon 26 May, etc.)
 */
export function dateLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";

  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
