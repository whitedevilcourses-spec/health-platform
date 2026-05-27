import { searchDoctorsFromFirestore } from "@/lib/server-firestore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doctors = await searchDoctorsFromFirestore({
      search: searchParams.get("search") || undefined,
      specialty: searchParams.get("specialty") || undefined,
      status: searchParams.get("status") || undefined,
      hospitalId: searchParams.get("hospitalId") || undefined,
      maxFee: searchParams.get("maxFee") ? Number(searchParams.get("maxFee")) : null,
    });
    return Response.json(doctors);
  } catch (error) {
    console.error("Doctor search error:", error);
    return Response.json({ error: "Failed to fetch doctors" }, { status: 500 });
  }
}
