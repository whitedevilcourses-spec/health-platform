import { NextResponse } from "next/server";
import { rtdb } from "@/lib/firebase";
import { ref, get, set, update, runTransaction, remove } from "firebase/database";
import {
  generateDaySlots,
  applyBookingStatus,
  dateKey,
  DEFAULT_SCHEDULE,
  type DoctorSchedule,
  type SlotStatus,
} from "@/lib/slot-engine";

export const dynamic = "force-dynamic";

const LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

/* ═══════════════════════════════════════════════════════════
   GET /api/slots?doctorId=xxx&date=2026-05-28
   Returns generated slots with live booking status overlaid.
═══════════════════════════════════════════════════════════ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get("doctorId");
    const dateStr = searchParams.get("date"); // "YYYY-MM-DD"

    if (!doctorId || !dateStr) {
      return NextResponse.json(
        { error: "doctorId and date query params are required" },
        { status: 400 }
      );
    }

    // Parse date
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    // Fetch doctor's schedule from RTD
    const scheduleSnap = await get(ref(rtdb, `doctorSchedules/${doctorId}`));
    const schedule: DoctorSchedule = scheduleSnap.exists()
      ? (scheduleSnap.val() as DoctorSchedule)
      : DEFAULT_SCHEDULE;

    // Generate raw slots
    const rawSlots = generateDaySlots(schedule, date);

    if (rawSlots.length === 0) {
      return NextResponse.json({ slots: [], available: 0, message: "Doctor not available on this date" });
    }

    // Fetch booking status from RTD: /slots/{doctorId}/{YYYY-MM-DD}/{slotId}
    const slotPath = `slots/${doctorId}/${dateStr}`;
    const bookingsSnap = await get(ref(rtdb, slotPath));
    const bookings = bookingsSnap.exists()
      ? (bookingsSnap.val() as Record<string, { status: SlotStatus; lockedAt?: number }>)
      : {};

    // Auto-release stale locks server-side (write cleanup to RTD)
    const now = Date.now();
    const staleKeys = Object.entries(bookings)
      .filter(([, v]) => v.status === "locked" && v.lockedAt && now - v.lockedAt > LOCK_TTL_MS)
      .map(([k]) => k);

    if (staleKeys.length > 0) {
      const updates: Record<string, null> = {};
      staleKeys.forEach((k) => {
        updates[`slots/${doctorId}/${dateStr}/${k}`] = null;
        delete bookings[k]; // Remove from local copy too
      });
      await update(ref(rtdb), updates);
    }

    // Overlay booking status onto generated slots
    const slots = applyBookingStatus(rawSlots, bookings);
    const available = slots.filter((s) => s.status === "available").length;

    return NextResponse.json({ slots, available, date: dateStr, doctorId });
  } catch (error) {
    console.error("GET /api/slots error:", error);
    return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════════════
   POST /api/slots
   Body: { action: "lock"|"release"|"confirm", doctorId, date, slotId, patientId?, appointmentId? }

   lock    — Atomically lock slot for 10 min during payment
   release — Release a previously locked slot (cancelled)
   confirm — Convert locked → booked after payment succeeds
═══════════════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, doctorId, date, slotId, patientId, appointmentId } = body;

    if (!action || !doctorId || !date || !slotId) {
      return NextResponse.json(
        { error: "action, doctorId, date, and slotId are required" },
        { status: 400 }
      );
    }

    const slotRef = ref(rtdb, `slots/${doctorId}/${date}/${slotId}`);

    /* ── LOCK ── */
    if (action === "lock") {
      if (!patientId) {
        return NextResponse.json({ error: "patientId required for lock" }, { status: 400 });
      }

      let lockResult: { success: boolean; message: string } = { success: false, message: "" };

      await runTransaction(slotRef, (current) => {
        const now = Date.now();

        // Slot is available or a stale lock — allow lock
        if (
          current === null ||
          current.status === "available" ||
          (current.status === "locked" && current.lockedAt && now - current.lockedAt > LOCK_TTL_MS)
        ) {
          lockResult = { success: true, message: "Slot locked successfully" };
          return {
            status: "locked",
            lockedAt: now,
            patientId,
          };
        }

        // Slot is already locked or booked — abort transaction (return undefined)
        lockResult = {
          success: false,
          message:
            current.status === "booked"
              ? "This slot has already been booked by another patient"
              : "This slot is currently being reserved by another patient. Please try a different time.",
        };
        return undefined; // Abort — do not write
      });

      return NextResponse.json(lockResult, { status: lockResult.success ? 200 : 409 });
    }

    /* ── RELEASE ── */
    if (action === "release") {
      const snap = await get(slotRef);
      if (!snap.exists()) {
        return NextResponse.json({ success: true, message: "Slot already available" });
      }
      const data = snap.val();
      if (data.status === "booked") {
        return NextResponse.json(
          { success: false, message: "Cannot release a confirmed booking" },
          { status: 409 }
        );
      }
      await remove(slotRef);
      return NextResponse.json({ success: true, message: "Slot released" });
    }

    /* ── CONFIRM ── */
    if (action === "confirm") {
      if (!appointmentId) {
        return NextResponse.json({ error: "appointmentId required for confirm" }, { status: 400 });
      }

      let confirmResult: { success: boolean; message: string } = { success: false, message: "" };

      await runTransaction(slotRef, (current) => {
        if (current === null) {
          confirmResult = { success: false, message: "Slot lock not found — it may have expired" };
          return undefined;
        }
        if (current.status !== "locked") {
          confirmResult = {
            success: false,
            message: `Cannot confirm — slot status is '${current.status}'`,
          };
          return undefined;
        }
        confirmResult = { success: true, message: "Slot confirmed" };
        return {
          status: "booked",
          patientId: current.patientId,
          appointmentId,
          bookedAt: Date.now(),
        };
      });

      return NextResponse.json(confirmResult, { status: confirmResult.success ? 200 : 409 });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("POST /api/slots error:", error);
    return NextResponse.json({ error: "Failed to process slot action" }, { status: 500 });
  }
}
