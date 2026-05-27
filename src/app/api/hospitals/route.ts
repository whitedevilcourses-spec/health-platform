import { searchHospitalsFromFirestore } from "@/lib/server-firestore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hospitals = await searchHospitalsFromFirestore({
      search: searchParams.get("search") || undefined,
      department: searchParams.get("department") || undefined,
      location: searchParams.get("location") || undefined,
      emergency: searchParams.get("emergency") === "true",
      insurance: searchParams.get("insurance") === "true",
      maxFee: searchParams.get("maxFee") ? Number(searchParams.get("maxFee")) : null,
      minRating: searchParams.get("minRating") ? Number(searchParams.get("minRating")) : null,
    });
    return Response.json(hospitals);
  } catch (error) {
    console.error("Hospital search error:", error);
    return Response.json({ error: "Failed to fetch hospitals" }, { status: 500 });
  }
}
