import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore-healthcare";

export const dynamic = "force-dynamic";

const schema = z.object({
  role: z.enum(["patient", "doctor", "admin", "manager"]),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  doctorProfile: z.object({
    specialty: z.string().min(1),
    hospitalName: z.string().min(1),
    city: z.string().min(1),
    fee: z.number().nonnegative(),
    yearsOfExperience: z.number().nonnegative(),
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
      return Response.json(
        { error: "Invalid profile payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { role, fullName, phone, doctorProfile } = parsed.data;
    const userRef = adminDb.collection(COLLECTIONS.users).doc(decoded.uid);

    await userRef.set(
      {
        uid: decoded.uid,
        email: decoded.email || "",
        fullName,
        phone: phone || null,
        role,
        onboardingCompleted: role === "doctor" ? Boolean(doctorProfile) : false,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (role === "doctor" && doctorProfile) {
      await adminDb.collection(COLLECTIONS.doctors).doc(decoded.uid).set(
        {
          uid: decoded.uid,
          fullName,
          email: decoded.email || "",
          specialty: doctorProfile.specialty,
          hospitalName: doctorProfile.hospitalName,
          city: doctorProfile.city,
          fee: doctorProfile.fee,
          yearsOfExperience: doctorProfile.yearsOfExperience,
          status: "online",
          rating: 0,
          reviewCount: 0,
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return Response.json({ success: true, uid: decoded.uid, role });
  } catch (error) {
    console.error("Profile bootstrap error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to bootstrap profile" },
      { status: 500 }
    );
  }
}
