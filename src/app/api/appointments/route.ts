import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore-healthcare";
import { createNotification, toIsoDate } from "@/lib/server-firestore";

export const dynamic = "force-dynamic";

const appointmentSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().min(2),
  patientEmail: z.string().email(),
  patientPhone: z.string().min(8),
  doctorId: z.string().min(1),
  doctorName: z.string().min(1),
  hospitalId: z.string().min(1),
  hospitalName: z.string().min(1),
  department: z.string().min(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlot: z.string().min(1),
  consultationType: z.enum(["video", "in_person", "callback"]).or(z.enum(["video", "in-person"])).transform((value) =>
    value === "in-person" ? "in_person" : value
  ),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = appointmentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid appointment payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const slotKey = `${payload.doctorId}_${payload.date}_${payload.timeSlot}`;
    const slotRef = adminDb.collection(COLLECTIONS.slots).doc(slotKey);
    const appointmentRef = adminDb.collection(COLLECTIONS.appointments).doc();

    await adminDb.runTransaction(async (transaction) => {
      const slotSnap = await transaction.get(slotRef);
      if (slotSnap.exists && slotSnap.data()?.status === "booked") {
        throw new Error("This slot has already been booked. Please choose another slot.");
      }

      transaction.set(slotRef, {
        slotKey,
        doctorId: payload.doctorId,
        hospitalId: payload.hospitalId,
        date: payload.date,
        timeSlot: payload.timeSlot,
        status: "booked",
        bookedBy: payload.patientEmail.toLowerCase(),
        appointmentId: appointmentRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(appointmentRef, {
        ...payload,
        patientEmail: payload.patientEmail.toLowerCase(),
        status: "confirmed",
        slotKey,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await Promise.all([
      createNotification({
        type: "appointment_confirmed",
        title: "Appointment confirmed",
        text: `${payload.doctorName} has been booked for ${payload.date} at ${payload.timeSlot}.`,
        targetUserIds: payload.patientId ? [payload.patientId] : [],
        metadata: { appointmentId: appointmentRef.id },
      }),
      adminDb.collection(COLLECTIONS.payments).add({
        appointmentId: appointmentRef.id,
        patientEmail: payload.patientEmail.toLowerCase(),
        amount: 0,
        currency: "INR",
        provider: "pending",
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      }),
    ]);

    const snapshot = await appointmentRef.get();
    const appointment = snapshot.data();

    return Response.json(
      {
        id: snapshot.id,
        ...appointment,
        createdAt: toIsoDate(appointment?.createdAt),
        updatedAt: toIsoDate(appointment?.updatedAt),
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to schedule appointment";
    const status = message.includes("already been booked") ? 409 : 500;
    console.error("Appointment booking error:", error);
    return Response.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const doctorId = searchParams.get("doctorId");

    if (!email && !doctorId) {
      return Response.json(
        { error: "Patient email or doctor ID is required to fetch appointments" },
        { status: 400 }
      );
    }

    let queryRef: FirebaseFirestore.Query = adminDb.collection(COLLECTIONS.appointments);
    if (email) {
      queryRef = queryRef.where("patientEmail", "==", email.toLowerCase());
    }
    if (doctorId) {
      queryRef = queryRef.where("doctorId", "==", doctorId);
    }

    const snapshot = await queryRef.orderBy("createdAt", "desc").get();
    const appointments = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        ...data,
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
      };
    });

    return Response.json(appointments);
  } catch (error) {
    console.error("Appointment history error:", error);
    return Response.json({ error: "Failed to fetch appointment history" }, { status: 500 });
  }
}
