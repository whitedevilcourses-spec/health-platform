import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore-healthcare";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["patient", "doctor", "manager"]),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  patientProfile: z.object({
    username: z.string().min(2),
    age: z.number().int().positive(),
    gender: z.string().min(1),
    bloodGroup: z.string().min(1),
    conditions: z.array(z.string()).default([]),
    allergies: z.array(z.string()).default([]),
    emergencyContact: z.string().min(3),
  }).optional(),
  doctorProfile: z.object({
    specialty: z.string().min(1),
    subSpecialization: z.string().optional(),
    degrees: z.string().min(1),
    yearsOfExperience: z.number().nonnegative(),
    city: z.string().min(1),
    hospitalId: z.string().optional(),
    hospitalName: z.string().min(1),
    fee: z.number().nonnegative(),
    languages: z.array(z.string()).default([]),
    availableTimings: z.array(z.string()).default([]),
  }).optional(),
  hospitalProfile: z.object({
    hospitalName: z.string().min(2),
    departments: z.array(z.string()).min(1),
    address: z.string().min(3),
    facilities: z.array(z.string()).default([]),
    emergencySupport: z.boolean(),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return Response.json({ error: "Missing Firebase ID token." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid profile payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const userRef = adminDb.collection(COLLECTIONS.users).doc(decoded.uid);
    await userRef.set({
      uid: decoded.uid,
      email: decoded.email || "",
      fullName: payload.fullName,
      phone: payload.phone || null,
      role: payload.role,
      onboardingCompleted: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (payload.role === "patient" && payload.patientProfile) {
      await adminDb.collection("patients").doc(decoded.uid).set({
        userId: decoded.uid,
        email: decoded.email || "",
        fullName: payload.fullName,
        ...payload.patientProfile,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await userRef.set({
        age: payload.patientProfile.age,
        gender: payload.patientProfile.gender,
        bloodGroup: payload.patientProfile.bloodGroup,
        emergencyContact: payload.patientProfile.emergencyContact,
      }, { merge: true });
    }

    if (payload.role === "doctor" && payload.doctorProfile) {
      await adminDb.collection(COLLECTIONS.doctors).doc(decoded.uid).set({
        uid: decoded.uid,
        email: decoded.email || "",
        fullName: payload.fullName,
        specialty: payload.doctorProfile.specialty,
        subSpecialization: payload.doctorProfile.subSpecialization || "",
        degrees: payload.doctorProfile.degrees,
        yearsOfExperience: payload.doctorProfile.yearsOfExperience,
        city: payload.doctorProfile.city,
        hospitalId: payload.doctorProfile.hospitalId || "",
        hospitalName: payload.doctorProfile.hospitalName,
        fee: payload.doctorProfile.fee,
        languages: payload.doctorProfile.languages,
        availableTimings: payload.doctorProfile.availableTimings,
        status: "online",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    if (payload.role === "manager" && payload.hospitalProfile) {
      const hospitalRef = adminDb.collection(COLLECTIONS.hospitals).doc();
      await hospitalRef.set({
        name: payload.hospitalProfile.hospitalName,
        departments: payload.hospitalProfile.departments,
        address: payload.hospitalProfile.address,
        facilities: payload.hospitalProfile.facilities,
        emergencySupport: payload.hospitalProfile.emergencySupport,
        insuranceSupported: false,
        consultationFee: 0,
        rating: 0,
        reviewCount: 0,
        managerId: decoded.uid,
        city: payload.hospitalProfile.address.split(",")[0]?.trim() || "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await userRef.set({ hospitalId: hospitalRef.id }, { merge: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Profile completion error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to complete profile" }, { status: 500 });
  }
}
