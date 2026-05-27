import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb, hasFirebaseAdminCredentials } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore-healthcare";
import { searchPublicDoctorsFromFirestore, searchPublicHospitalsFromFirestore } from "@/lib/public-firestore-search";
import { generateStructuredJson, hasConfiguredAiProvider } from "@/lib/server-ai";
import { buildAssessmentFallback } from "@/lib/triage-fallback";

export const dynamic = "force-dynamic";

const assessmentSchema = z.object({
  sessionId: z.string().optional(),
  patientId: z.string().optional(),
  fullName: z.string().min(2),
  age: z.string().min(1),
  gender: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email(),
  location: z.string().min(2),
  symptoms: z.string().min(3),
  existingConditions: z.string().optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  emergencyContact: z.string().min(8),
  additionalNotes: z.string().optional(),
});

function buildFollowUpQuestion(symptoms: string) {
  const lower = symptoms.toLowerCase();
  if (lower.includes("head")) {
    return {
      question:
        "Where is the headache located, how severe is it, and are you also having nausea, light sensitivity, dizziness, fever, or blurred vision?",
      options: [
        "Front of head / one side / behind eyes / back of head / entire head",
        "Mild / moderate / severe",
        "Associated symptoms: nausea, light sensitivity, dizziness, fever, blurred vision",
      ],
    };
  }

  if (lower.includes("chest") || lower.includes("heart")) {
    return {
      question:
        "Is the discomfort pressure-like, sharp, or burning, does it spread to the arm, jaw, or back, and are you short of breath, sweaty, dizzy, or nauseated?",
      options: [
        "Pressure / tightness / sharp / burning",
        "Radiation to arm, jaw, shoulder, or back",
        "Shortness of breath, sweating, dizziness, nausea",
      ],
    };
  }

  if (lower.includes("back") || lower.includes("spine")) {
    return {
      question:
        "Are you experiencing any radiating pain, numbness, tingling, or weakness in your legs, or any loss of bladder control?",
      options: [
        "Pain shooting down the leg",
        "Numbness or tingling in legs",
        "Loss of bladder or bowel control",
        "Fever or recent injury",
      ],
    };
  }

  if (lower.includes("stomach") || lower.includes("abdom") || lower.includes("belly") || lower.includes("pain")) {
    return {
      question:
        "Where exactly is the pain located, is it sharp or cramping, and are you experiencing vomiting, fever, or diarrhea?",
      options: [
        "Upper abdomen / heartburn-like",
        "Lower right side / sharp",
        "Cramping all over",
        "Accompanied by fever or vomiting",
      ],
    };
  }

  if (lower.includes("skin") || lower.includes("rash") || lower.includes("itch")) {
    return {
      question:
        "Is the rash spreading rapidly, painful, or blistering, and do you have any facial swelling or difficulty breathing?",
      options: [
        "Swelling of the face or lips",
        "Difficulty breathing or swallowing",
        "Spreading rapidly or blistering",
        "Accompanied by fever",
      ],
    };
  }

  return {
    question:
      "To assess this safely, please share the exact location, severity from 1-10, how long it has been present, and any associated symptoms such as fever, vomiting, breathing trouble, weakness, or dizziness.",
    options: [
      "Location of symptoms",
      "Severity and duration",
      "Associated symptoms and medical history",
    ],
  };
}

function createSessionId() {
  return crypto.randomUUID();
}

function getAssessmentErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.toLowerCase().includes("default credentials")) {
    return "The assessment service is still being connected. Please try again shortly.";
  }

  if (message.toLowerCase().includes("no ai provider configured")) {
    return "The assessment service is still being configured. Please try again shortly.";
  }

  return "We couldn't complete your assessment right now. Please try again in a moment.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = assessmentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid assessment payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const sessionId = input.sessionId || createSessionId();
    const sessionRef = hasFirebaseAdminCredentials
      ? adminDb.collection(COLLECTIONS.aiSessions).doc(sessionId)
      : null;

    const sessionSnap = sessionRef ? await sessionRef.get() : null;
    const priorConversation = sessionSnap?.exists
      ? ((sessionSnap.data()?.conversation as Array<{ role: string; content: string }>) || [])
      : [];

    const newConversation = [
      ...priorConversation,
      { role: "user", content: input.symptoms, createdAt: new Date().toISOString() },
    ];

    if (input.symptoms.trim().split(/\s+/).length < 8 && priorConversation.length === 0) {
      let followUp;
      if (hasConfiguredAiProvider()) {
        try {
          followUp = await generateStructuredJson<{
            question: string;
            options: string[];
          }>(
            "You are a clinical triage assistant. The user provided a brief symptom description. Generate a highly relevant follow-up question to gather more clinical context. Return JSON with 'question' (string) and 'options' (array of 4-6 strings).",
            `Symptom: ${input.symptoms}`
          );
        } catch (e) {
          console.error("Failed to generate dynamic assessment question:", e);
          followUp = buildFollowUpQuestion(input.symptoms);
        }
      } else {
        followUp = buildFollowUpQuestion(input.symptoms);
      }

      if (sessionRef) {
        await sessionRef.set(
          {
            patientId: input.patientId || null,
            patientSnapshot: {
              fullName: input.fullName,
              age: input.age,
              gender: input.gender,
              phone: input.phone,
              email: input.email,
              location: input.location,
            },
            conversation: [
              ...newConversation,
              { role: "assistant", content: followUp.question, createdAt: new Date().toISOString() },
            ],
            status: "collecting",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: sessionSnap?.exists ? sessionSnap.data()?.createdAt : FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return Response.json({
        kind: "follow_up",
        sessionId,
        ...followUp,
      });
    }

    const aiResult = hasConfiguredAiProvider()
      ? await generateStructuredJson<{
          urgencyLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
          clinicalSummary: string;
          symptomCorrelation: string[];
          severityAssessment: string;
          confidenceScore: number;
          specialistRecommendation: string;
          recommendedActions: string[];
          emergencyWarnings: string[];
          followUpTimeline: string;
        }>(
          "You are a clinical triage assistant. Do not diagnose. Return only JSON with keys: urgencyLevel, clinicalSummary, symptomCorrelation, severityAssessment, confidenceScore, specialistRecommendation, recommendedActions, emergencyWarnings, followUpTimeline.",
          `Patient intake:
          Name: ${input.fullName}
          Age: ${input.age}
          Gender: ${input.gender}
          Symptoms: ${input.symptoms}
          Existing conditions: ${input.existingConditions || "None provided"}
          Allergies: ${input.allergies || "None provided"}
          Current medications: ${input.currentMedications || "None provided"}
          Additional notes: ${input.additionalNotes || "None provided"}
          Location: ${input.location}
          `
        )
      : buildAssessmentFallback(input);

    const [doctorsResult, hospitalsResult] = await Promise.allSettled([
      searchPublicDoctorsFromFirestore({
        specialty: aiResult.specialistRecommendation,
        status: "online",
      }),
      searchPublicHospitalsFromFirestore({
        department: aiResult.specialistRecommendation,
        location: input.location,
      }),
    ]);

    const recommendedDoctors =
      doctorsResult.status === "fulfilled" ? doctorsResult.value : [];
    const recommendedHospitals =
      hospitalsResult.status === "fulfilled" ? hospitalsResult.value : [];

    if (sessionRef) {
      await sessionRef.set(
        {
          patientId: input.patientId || null,
          patientSnapshot: {
            fullName: input.fullName,
            age: input.age,
            gender: input.gender,
            phone: input.phone,
            email: input.email,
            location: input.location,
            existingConditions: input.existingConditions || null,
            allergies: input.allergies || null,
            currentMedications: input.currentMedications || null,
          },
          conversation: [
            ...newConversation,
            { role: "assistant", content: JSON.stringify(aiResult), createdAt: new Date().toISOString() },
          ],
          triageResult: aiResult,
          recommendedDoctorIds: recommendedDoctors.slice(0, 3).map((doctor) => doctor.uid),
          recommendedHospitalIds: recommendedHospitals.slice(0, 3).map((hospital) => hospital.id),
          status: "triaged",
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: sessionSnap?.exists ? sessionSnap.data()?.createdAt : FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return Response.json({
      kind: "assessment",
      sessionId,
      ...aiResult,
      hospitalRecommendation: recommendedHospitals.slice(0, 3).map((hospital) => hospital.name),
      doctorRecommendation: recommendedDoctors.slice(0, 3).map((doctor) => doctor.fullName),
    });
  } catch (error) {
    console.error("Assessment API error:", error);
    return Response.json(
      { error: getAssessmentErrorMessage(error) },
      { status: 500 }
    );
  }
}
