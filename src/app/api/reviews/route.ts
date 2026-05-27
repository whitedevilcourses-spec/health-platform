import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore-healthcare";
import { toIsoDate } from "@/lib/server-firestore";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  doctorId: z.string().min(1),
  patientId: z.string().nullable().optional(),
  patientEmail: z.string().email(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid review payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const doctorRef = adminDb.collection(COLLECTIONS.doctors).doc(payload.doctorId);
    const reviewRef = adminDb.collection(COLLECTIONS.reviews).doc();

    await adminDb.runTransaction(async (transaction) => {
      const doctorSnapshot = await transaction.get(doctorRef);
      if (!doctorSnapshot.exists) {
        throw new Error("Doctor profile not found.");
      }

      const doctorData = doctorSnapshot.data() || {};
      const currentReviewCount = Number(doctorData.reviewCount || 0);
      const currentRating = Number(doctorData.rating || 0);
      const nextReviewCount = currentReviewCount + 1;
      const nextRating = Number(
        ((currentRating * currentReviewCount + payload.rating) / nextReviewCount).toFixed(1)
      );

      transaction.set(reviewRef, {
        doctorId: payload.doctorId,
        patientId: payload.patientId || null,
        patientEmail: payload.patientEmail.toLowerCase(),
        rating: payload.rating,
        comment: payload.comment || "",
        createdAt: FieldValue.serverTimestamp(),
      });

      transaction.update(doctorRef, {
        rating: nextRating,
        reviewCount: nextReviewCount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const reviewSnapshot = await reviewRef.get();
    const review = reviewSnapshot.data();

    return Response.json(
      {
        id: reviewSnapshot.id,
        ...review,
        createdAt: toIsoDate(review?.createdAt),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Review submission error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to submit review" },
      { status: 500 }
    );
  }
}
