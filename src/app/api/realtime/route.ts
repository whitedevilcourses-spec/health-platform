import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore-healthcare";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [telemetrySnap, notificationsSnap] = await Promise.all([
      adminDb.collection(COLLECTIONS.telemetry).doc("live").get(),
      adminDb.collection(COLLECTIONS.notifications).orderBy("createdAt", "desc").limit(5).get(),
    ]);

    return Response.json({
      telemetry: telemetrySnap.exists ? telemetrySnap.data() : null,
      notifications: notificationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch (error) {
    console.error("Realtime snapshot error:", error);
    return Response.json({ error: "Failed to fetch realtime snapshot" }, { status: 500 });
  }
}
