import mongoose from "mongoose";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { connectToDatabase } from "@/server/db/mongoose";
import { createAiSession, findAiSessionById } from "@/server/repositories/ai-session-repository";
import type { AIProvider } from "@/server/types/domain";

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

interface AssessmentInput {
  sessionId?: string;
  patientId?: string;
  fullName: string;
  age: string;
  gender: string;
  phone: string;
  email: string;
  location: string;
  symptoms: string;
  existingConditions?: string;
  allergies?: string;
  currentMedications?: string;
  emergencyContact: string;
  additionalNotes?: string;
}

function needsFollowUp(symptoms: string) {
  const words = symptoms.trim().split(/\s+/);
  return words.length < 8;
}

function buildFollowUpQuestion(symptoms: string) {
  const text = symptoms.toLowerCase();
  if (text.includes("head")) {
    return {
      question:
        "Where is the headache located, how would you describe the pain, and are you also having nausea, dizziness, fever, light sensitivity, or blurred vision?",
      options: [
        "Front of head / one side / behind eyes / back of head / entire head",
        "Throbbing / pressure-like / sharp / dull ache / burning",
        "Associated symptoms: nausea, fever, dizziness, light sensitivity, blurred vision",
      ],
    };
  }

  if (text.includes("chest")) {
    return {
      question:
        "Is the chest discomfort pressure-like, sharp, or burning, does it spread to the arm/jaw/back, and are you short of breath, sweaty, dizzy, or nauseated?",
      options: [
        "Pressure / tightness / stabbing / burning",
        "Radiation to arm, jaw, shoulder, or back",
        "Shortness of breath, sweating, dizziness, nausea",
      ],
    };
  }

  return {
    question:
      "To assess this safely, please describe where the symptom is located, how severe it is from 1-10, when it started, and any associated symptoms such as fever, breathing trouble, vomiting, dizziness, or weakness.",
    options: [
      "Location of symptoms",
      "Severity from 1-10 and timing",
      "Associated symptoms and medical history",
    ],
  };
}

function buildRulesBasedAssessment(input: AssessmentInput) {
  const lower = input.symptoms.toLowerCase();
  const critical =
    lower.includes("chest pain") ||
    lower.includes("shortness of breath") ||
    lower.includes("stroke") ||
    lower.includes("seizure");

  const urgencyLevel = critical
    ? "CRITICAL"
    : lower.includes("fever") || lower.includes("vomit")
      ? "HIGH"
      : "MODERATE";

  return {
    urgencyLevel,
    clinicalSummary: `${input.fullName} reports ${input.symptoms}. The presentation was reviewed against symptom severity, associated-system involvement, and reported medical history to guide next-step care routing.`,
    symptomCorrelation: [
      "Primary presenting symptom cluster extracted from free-text intake",
      input.existingConditions
        ? `Existing conditions considered: ${input.existingConditions}`
        : "No pre-existing condition modifiers were supplied",
      input.currentMedications
        ? `Current medications reviewed for interaction context: ${input.currentMedications}`
        : "No active medications supplied in the intake",
    ],
    severityAssessment: critical
      ? "Potential emergency-pattern features detected. Immediate clinician review is recommended."
      : "Symptoms suggest non-trivial clinical evaluation is warranted, but the pattern is not definitively emergent from the supplied information alone.",
    confidenceScore: critical ? 92 : 78,
    specialistRecommendation: critical ? "Emergency Medicine" : "General Medicine",
    hospitalRecommendation: [],
    recommendedActions: [
      "Arrange a clinician evaluation based on the urgency level above.",
      "Track progression, triggers, and associated symptoms until reviewed.",
      "Escalate to emergency care immediately if red-flag symptoms intensify.",
    ],
    emergencyWarnings: critical
      ? [
          "Worsening chest pain, severe shortness of breath, fainting, or neurological deficit require immediate emergency response.",
        ]
      : [
          "Go to urgent or emergency care if symptoms escalate rapidly, you become faint, confused, or unable to keep fluids down.",
        ],
    followUpTimeline: critical ? "Immediate evaluation now." : "Schedule medical review within 24 hours.",
  };
}

async function runOpenAITriage(prompt: string) {
  if (!openaiClient) {
    return null;
  }

  const completion = await openaiClient.chat.completions.create({
    model: process.env.OPENAI_TRIAGE_MODEL || "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a clinical triage assistant. Return only JSON with keys: urgencyLevel, clinicalSummary, symptomCorrelation, severityAssessment, confidenceScore, specialistRecommendation, hospitalRecommendation, recommendedActions, emergencyWarnings, followUpTimeline.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  return content ? JSON.parse(content) : null;
}

async function runGeminiTriage(prompt: string) {
  if (!geminiClient) {
    return null;
  }

  const model = geminiClient.getGenerativeModel({
    model: process.env.GEMINI_TRIAGE_MODEL || "gemini-1.5-pro",
  });

  const response = await model.generateContent(
    `${prompt}\nReturn only valid JSON with keys urgencyLevel, clinicalSummary, symptomCorrelation, severityAssessment, confidenceScore, specialistRecommendation, hospitalRecommendation, recommendedActions, emergencyWarnings, followUpTimeline.`
  );
  return JSON.parse(response.response.text().replace(/```json|```/g, "").trim());
}

export async function createAssessment(input: AssessmentInput) {
  await connectToDatabase();

  const existingSession = input.sessionId ? await findAiSessionById(input.sessionId) : null;
  const followUp = needsFollowUp(input.symptoms) ? buildFollowUpQuestion(input.symptoms) : null;

  const session =
    existingSession ||
    (await createAiSession({
      patientId: input.patientId ? new mongoose.Types.ObjectId(input.patientId) : undefined,
      patientSnapshot: {
        fullName: input.fullName,
        age: input.age,
        gender: input.gender,
        email: input.email,
        phone: input.phone,
        location: input.location,
        existingConditions: input.existingConditions,
        allergies: input.allergies,
        currentMedications: input.currentMedications,
      },
      symptomSummary: input.symptoms,
      conversation: [],
    }));

  session.conversation.push({
    role: "user",
    content: input.symptoms,
    createdAt: new Date(),
  });

  if (followUp && session.status !== "triaged") {
    session.conversation.push({
      role: "assistant",
      content: followUp.question,
      createdAt: new Date(),
    });
    await session.save();

    return {
      sessionId: session._id.toString(),
      kind: "follow_up",
      ...followUp,
    };
  }

  const prompt = `
Patient:
- Name: ${input.fullName}
- Age: ${input.age}
- Gender: ${input.gender}
- Symptoms: ${input.symptoms}
- Existing conditions: ${input.existingConditions || "None supplied"}
- Allergies: ${input.allergies || "None supplied"}
- Current medications: ${input.currentMedications || "None supplied"}
- Additional notes: ${input.additionalNotes || "None supplied"}
- Location: ${input.location}

Provide a structured clinical triage response. Do not claim definitive diagnosis.
  `;

  let triageResult: Record<string, unknown> | null = null;
  let provider: AIProvider = "rules";

  try {
    triageResult = await runOpenAITriage(prompt);
    if (triageResult) {
      provider = "openai";
    }
  } catch {
    triageResult = null;
  }

  if (!triageResult) {
    try {
      triageResult = await runGeminiTriage(prompt);
      if (triageResult) {
        provider = "gemini";
      }
    } catch {
      triageResult = null;
    }
  }

  if (!triageResult) {
    triageResult = buildRulesBasedAssessment(input);
  }

  session.provider = provider;
  session.status = "triaged";
  session.triageResult = triageResult;
  session.conversation.push({
    role: "assistant",
    content: JSON.stringify(triageResult),
    createdAt: new Date(),
  });
  await session.save();

  return {
    sessionId: session._id.toString(),
    kind: "assessment",
    provider,
    ...triageResult,
  };
}
