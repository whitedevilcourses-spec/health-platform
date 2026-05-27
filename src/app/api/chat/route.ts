import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb, hasFirebaseAdminCredentials } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore-healthcare";
import { searchPublicHospitalsFromFirestore } from "@/lib/public-firestore-search";
import { generateStructuredJson, hasConfiguredAiProvider } from "@/lib/server-ai";
import { buildChatFallback } from "@/lib/triage-fallback";

export const dynamic = "force-dynamic";

const chatSchema = z.object({
  sessionId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    })
  ),
});

function buildQuestion(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("head")) {
    return {
      type: "question" as const,
      question_type: "chips" as const,
      question: "Where is the headache mainly located?",
      options: [
        "Front of head",
        "One side",
        "Behind the eyes",
        "Back of head",
        "Entire head",
      ],
      step_number: 1,
      total_steps: 2,
      insight: "Location helps separate common migraine, tension, sinus, and neurological patterns.",
    };
  }

  if (lower.includes("chest") || lower.includes("heart")) {
    return {
      type: "question" as const,
      question_type: "chips" as const,
      question: "Which description fits the chest symptom best right now?",
      options: [
        "Pressure or tightness",
        "Sharp pain",
        "Burning sensation",
        "Pain spreading to arm, jaw, or back",
        "Shortness of breath with it",
      ],
      step_number: 1,
      total_steps: 2,
      insight: "The symptom pattern helps decide whether this needs urgent emergency review.",
    };
  }

  if (lower.includes("back") || lower.includes("spine")) {
    return {
      type: "question" as const,
      question_type: "multi" as const,
      question: "Are you experiencing any of these other symptoms with your back pain?",
      options: [
        "Pain shooting down the leg",
        "Numbness or tingling",
        "Loss of bladder/bowel control",
        "Fever",
        "Recent injury or fall",
      ],
      step_number: 1,
      total_steps: 2,
      insight: "Identifying nerve compression or red flags like fever helps triage back pain effectively.",
    };
  }

  if (lower.includes("stomach") || lower.includes("abdom") || lower.includes("belly") || lower.includes("pain")) {
    return {
      type: "question" as const,
      question_type: "chips" as const,
      question: "Where exactly is the pain located and how does it feel?",
      options: [
        "Upper abdomen / heartburn",
        "Lower right side",
        "Cramping all over",
        "Sharp and sudden",
        "Constant and worsening",
      ],
      step_number: 1,
      total_steps: 2,
      insight: "Location and onset help differentiate between minor gastric issues and surgical emergencies like appendicitis.",
    };
  }

  if (lower.includes("skin") || lower.includes("rash") || lower.includes("itch")) {
    return {
      type: "question" as const,
      question_type: "multi" as const,
      question: "Are you having any of these associated symptoms with the skin issue?",
      options: [
        "Swelling of the face or lips",
        "Difficulty breathing",
        "Fever",
        "Spreading rapidly",
        "Painful or blistering",
      ],
      step_number: 1,
      total_steps: 2,
      insight: "Checking for anaphylaxis or severe infection is critical for skin presentations.",
    };
  }

  return {
    type: "question" as const,
    question_type: "multi" as const,
    question: "Which of these are happening along with your main symptom?",
    options: ["Fever", "Nausea or vomiting", "Dizziness", "Shortness of breath", "Weakness or numbness"],
    step_number: 1,
    total_steps: 2,
    insight: "Associated symptoms help decide urgency and the most appropriate care pathway.",
  };
}

function createSessionId() {
  return crypto.randomUUID();
}

function getChatErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.toLowerCase().includes("default credentials")) {
    return "The chat assistant is still being connected. Please try again shortly.";
  }

  if (message.toLowerCase().includes("no ai provider configured")) {
    return "The chat assistant is still being configured. Please try again shortly.";
  }

  return "I couldn't complete that assessment right now. Please try again in a moment.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid chat payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { messages } = parsed.data;
    const sessionId = parsed.data.sessionId || createSessionId();
    const sessionRef = hasFirebaseAdminCredentials
      ? adminDb.collection(COLLECTIONS.aiSessions).doc(sessionId)
      : null;
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    const userMessages = messages.filter((message) => message.role === "user");

    if (!latestUserMessage) {
      return Response.json({ error: "A user message is required." }, { status: 400 });
    }

    if (userMessages.length === 1 && latestUserMessage.content.trim().split(/\s+/).length < 8) {
      let questionPayload;
      if (hasConfiguredAiProvider()) {
        try {
          const aiQuestion = await generateStructuredJson<{
            question: string;
            options: string[];
            question_type: "chips" | "multi";
            insight: string;
          }>(
            "You are a clinical triage assistant. The user provided a brief symptom description. Generate a highly relevant follow-up question to gather more clinical context. Return JSON with 'question' (string), 'options' (array of 4-6 strings), 'question_type' (must be exactly 'multi' or 'chips'), and 'insight' (short explanation string).",
            `Symptom: ${latestUserMessage.content}`
          );
          questionPayload = {
            ...aiQuestion,
            type: "question" as const,
            step_number: 1,
            total_steps: 2,
          };
        } catch (e) {
          console.error("Failed to generate dynamic question:", e);
          questionPayload = buildQuestion(latestUserMessage.content);
        }
      } else {
        questionPayload = buildQuestion(latestUserMessage.content);
      }

      if (sessionRef) {
        await sessionRef.set(
          {
            conversation: [
              ...messages,
              { role: "assistant", content: questionPayload.question, createdAt: new Date().toISOString() },
            ],
            status: "collecting",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      return Response.json(questionPayload);
    }

    const combinedHistory = messages
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n");

    const aiResult = hasConfiguredAiProvider()
      ? await generateStructuredJson<{
          type: "report";
          triage_summary: string;
          symptom_clusters: Array<{ cluster: string; detail: string }>;
          clinical_considerations: string[];
          risk: {
            severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
            confidence: number;
            urgency_recommendation: string;
            emergency_risk: string;
          };
          specialists: {
            primary: string;
            secondary: string[];
          };
          immediate_actions: string[];
          emergency_signs: string[];
          followup_timeline: string;
          disclaimer: string;
        }>(
          "You are a clinical triage assistant. Return only JSON with keys: type, triage_summary, symptom_clusters, clinical_considerations, risk, specialists, immediate_actions, emergency_signs, followup_timeline, disclaimer. Set type to 'report'.",
          combinedHistory
        )
      : buildChatFallback(messages);

    const recommendedHospitals = await searchPublicHospitalsFromFirestore({
      department: aiResult.specialists.primary,
    });

    const responsePayload = {
      ...aiResult,
      type: "report" as const,
      recommended_hospitals: recommendedHospitals
        .slice(0, 3)
        .map((hospital) => `${hospital.name} — ${hospital.city || hospital.address || "Location pending"}`),
    };

    if (sessionRef) {
      await sessionRef.set(
        {
          conversation: [
            ...messages,
            { role: "assistant", content: JSON.stringify(responsePayload), createdAt: new Date().toISOString() },
          ],
          triageResult: responsePayload,
          status: "triaged",
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await adminDb.collection(COLLECTIONS.chatMessages).add({
        sessionId,
        messages,
        response: responsePayload,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return Response.json(responsePayload);
  } catch (error) {
    console.error("Chat triage error:", error);
    return Response.json(
      { error: getChatErrorMessage(error) },
      { status: 500 }
    );
  }
}
