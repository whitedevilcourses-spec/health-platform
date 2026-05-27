type TriageLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

type ClinicalSignals = {
  headache: boolean;
  chestPain: boolean;
  breathingDifficulty: boolean;
  fever: boolean;
  nausea: boolean;
  vomiting: boolean;
  dizziness: boolean;
  blurredVision: boolean;
  weakness: boolean;
  numbness: boolean;
  confusion: boolean;
  seizure: boolean;
  abdominalPain: boolean;
  diarrhea: boolean;
  cough: boolean;
  soreThroat: boolean;
  rash: boolean;
  palpitations: boolean;
  severePain: boolean;
  fainting: boolean;
};

type ClinicalProfile = {
  severity: TriageLevel;
  specialist: string;
  secondarySpecialists: string[];
  clinicalSummary: string;
  symptomCorrelation: string[];
  clinicalConsiderations: string[];
  immediateActions: string[];
  emergencySigns: string[];
  urgencyRecommendation: string;
  followUpTimeline: string;
  confidence: number;
};

function detectSignals(input: string): ClinicalSignals {
  const text = input.toLowerCase();

  return {
    headache: /\b(headache|migraine|head pain)\b/.test(text),
    chestPain: /\b(chest pain|chest tightness|tightness in chest|pressure in chest|chest discomfort)\b/.test(text),
    breathingDifficulty: /\b(shortness of breath|difficulty breathing|breathless|can't breathe|cannot breathe|trouble breathing)\b/.test(text),
    fever: /\b(fever|temperature|chills)\b/.test(text),
    nausea: /\b(nausea)\b/.test(text),
    vomiting: /\b(vomit|vomiting)\b/.test(text),
    dizziness: /\b(dizziness|dizzy|vertigo)\b/.test(text),
    blurredVision: /\b(blurred vision|vision changes|double vision|sensitivity to light|light sensitivity)\b/.test(text),
    weakness: /\b(weakness|one-sided weakness|unable to move)\b/.test(text),
    numbness: /\b(numbness|tingling)\b/.test(text),
    confusion: /\b(confusion|confused|slurred speech)\b/.test(text),
    seizure: /\b(seizure|convulsion)\b/.test(text),
    abdominalPain: /\b(stomach pain|abdominal pain|abdomen pain|belly pain|gastric pain)\b/.test(text),
    diarrhea: /\b(diarrhea|loose stools)\b/.test(text),
    cough: /\b(cough|coughing)\b/.test(text),
    soreThroat: /\b(sore throat|throat pain)\b/.test(text),
    rash: /\b(rash|itching|hives|skin eruption)\b/.test(text),
    palpitations: /\b(palpitations|racing heart|rapid heartbeat)\b/.test(text),
    severePain: /\b(severe|worst|unbearable|intense|10\/10|9\/10|8\/10)\b/.test(text),
    fainting: /\b(fainting|fainted|passed out|collapse)\b/.test(text),
  };
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeSymptoms(signals: ClinicalSignals) {
  const items: string[] = [];

  if (signals.headache) items.push("headache");
  if (signals.chestPain) items.push("chest discomfort");
  if (signals.breathingDifficulty) items.push("breathing difficulty");
  if (signals.fever) items.push("fever");
  if (signals.nausea || signals.vomiting) items.push("nausea or vomiting");
  if (signals.dizziness) items.push("dizziness");
  if (signals.blurredVision) items.push("vision changes");
  if (signals.abdominalPain) items.push("abdominal pain");
  if (signals.cough) items.push("cough");
  if (signals.rash) items.push("skin symptoms");

  if (items.length === 0) {
    return "the reported symptoms";
  }

  if (items.length === 1) {
    return items[0];
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function buildClinicalProfile(input: string): ClinicalProfile {
  const signals = detectSignals(input);
  const symptomSummary = summarizeSymptoms(signals);

  const neurologicalRedFlags =
    signals.weakness || signals.numbness || signals.confusion || signals.seizure;
  const cardiopulmonaryRedFlags =
    signals.chestPain && (signals.breathingDifficulty || signals.palpitations || signals.fainting);
  const severeHeadachePattern =
    signals.headache && signals.severePain && (signals.nausea || signals.blurredVision || signals.dizziness);
  const severeAbdominalPattern =
    signals.abdominalPain && signals.severePain && (signals.vomiting || signals.fever);

  let severity: TriageLevel = "LOW";

  if (cardiopulmonaryRedFlags || neurologicalRedFlags) {
    severity = "CRITICAL";
  } else if (severeHeadachePattern || severeAbdominalPattern || (signals.fever && signals.breathingDifficulty)) {
    severity = "HIGH";
  } else if (
    signals.headache ||
    signals.fever ||
    signals.abdominalPain ||
    signals.cough ||
    signals.rash ||
    signals.dizziness
  ) {
    severity = "MODERATE";
  }

  let specialist = "General Medicine";
  let secondarySpecialists: string[] = [];
  let clinicalConsiderations: string[] = [
    "The pattern should be interpreted alongside an in-person examination, vital signs, and any relevant medical history.",
  ];

  if (signals.chestPain || signals.palpitations) {
    specialist = severity === "CRITICAL" ? "Emergency Medicine" : "Cardiology";
    secondarySpecialists = ["General Medicine"];
    clinicalConsiderations = [
      "Cardiopulmonary causes should be ruled out, especially when chest discomfort appears with breathlessness, palpitations, or fainting.",
      "A clinician may need ECG, vitals, and oxygen saturation if symptoms are active or worsening.",
    ];
  } else if (signals.headache || signals.blurredVision || signals.dizziness) {
    specialist = "Neurology";
    secondarySpecialists = ["General Medicine", "ENT"];
    clinicalConsiderations = [
      "Headache with nausea, dizziness, or visual symptoms can overlap with migraine, dehydration, sinus causes, infection, or neurological conditions.",
      "Urgency rises when pain is sudden, unusually severe, associated with weakness, confusion, or vision loss.",
    ];
  } else if (signals.abdominalPain || signals.diarrhea) {
    specialist = "Gastroenterology";
    secondarySpecialists = ["General Medicine"];
    clinicalConsiderations = [
      "Abdominal pain patterns are usually separated by location, meal timing, fever, bowel changes, and vomiting.",
      "Same-day review is more important when pain is severe, persistent, or associated with dehydration or fever.",
    ];
  } else if (signals.cough || signals.soreThroat || signals.breathingDifficulty || signals.fever) {
    specialist = "Pulmonology";
    secondarySpecialists = ["General Medicine"];
    clinicalConsiderations = [
      "Respiratory symptoms often need review of fever pattern, oxygen levels, cough duration, and breathing effort.",
      "Urgency increases if shortness of breath, chest pain, bluish lips, or confusion are present.",
    ];
  } else if (signals.rash) {
    specialist = "Dermatology";
    secondarySpecialists = ["General Medicine"];
    clinicalConsiderations = [
      "Skin symptoms are triaged based on spread, itch, pain, fever, swelling, and exposure history.",
      "Escalation is needed if the rash is rapidly spreading or appears with breathing trouble or facial swelling.",
    ];
  }

  const symptomCorrelation = [
    `Current symptom pattern includes ${symptomSummary}.`,
    severity === "CRITICAL"
      ? "The combination of symptoms includes one or more emergency warning signals that need urgent in-person review."
      : severity === "HIGH"
      ? "The current combination suggests a higher-risk presentation that should be assessed promptly."
      : severity === "MODERATE"
      ? "The symptoms suggest an active medical concern that should be reviewed soon if it persists or worsens."
      : "No immediate emergency red flag is obvious from the text alone, but symptom evolution still matters.",
  ];

  if (signals.severePain) {
    symptomCorrelation.push("Severe pain increases the need for same-day clinical review.");
  }
  if (signals.nausea || signals.vomiting) {
    symptomCorrelation.push("Nausea or vomiting can shift triage urgency depending on hydration, duration, and associated pain.");
  }
  if (signals.fever) {
    symptomCorrelation.push("Fever raises concern for infection and should be interpreted with duration and associated symptoms.");
  }

  const immediateActions =
    severity === "CRITICAL"
      ? [
          "Seek emergency medical care immediately.",
          "Do not drive yourself if you feel faint, weak, or short of breath.",
          "Keep someone with you while you arrange urgent care.",
        ]
      : severity === "HIGH"
      ? [
          "Arrange urgent in-person medical review today.",
          "Avoid strenuous activity until a clinician has assessed you.",
          "Stay hydrated and track any worsening symptoms while arranging care.",
        ]
      : severity === "MODERATE"
      ? [
          "Book a same-day or next-day clinical review if symptoms continue.",
          "Monitor fever, pain level, breathing, and hydration closely.",
          "Escalate sooner if symptoms worsen or new warning signs appear.",
        ]
      : [
          "Monitor the symptoms and note any new changes.",
          "Arrange a routine medical review if symptoms continue or recur.",
          "Seek faster care if pain, fever, breathing trouble, or weakness develops.",
        ];

  const emergencySigns = [
    "Trouble breathing or worsening shortness of breath",
    "New confusion, fainting, or seizure activity",
    "One-sided weakness, numbness, or speech difficulty",
    "Sudden severe chest pain, collapse, or persistent vomiting",
  ];

  const urgencyRecommendation =
    severity === "CRITICAL"
      ? "Emergency evaluation is recommended now."
      : severity === "HIGH"
      ? "Urgent same-day clinical assessment is recommended."
      : severity === "MODERATE"
      ? "Prompt outpatient review is recommended within the next 24 hours."
      : "Routine review is reasonable if symptoms remain mild and stable.";

  const followUpTimeline =
    severity === "CRITICAL"
      ? "Immediate emergency care."
      : severity === "HIGH"
      ? "Same-day medical review."
      : severity === "MODERATE"
      ? "Clinical follow-up within 24 hours if symptoms persist."
      : "Review within the next few days if symptoms do not settle.";

  const confidence = Math.min(
    90,
    64 +
      (signals.headache ? 4 : 0) +
      (signals.chestPain ? 6 : 0) +
      (signals.breathingDifficulty ? 6 : 0) +
      (signals.fever ? 4 : 0) +
      (signals.abdominalPain ? 4 : 0) +
      (signals.severePain ? 4 : 0)
  );

  return {
    severity,
    specialist,
    secondarySpecialists,
    clinicalSummary: `Based on the symptoms described, the current pattern centres on ${symptomSummary}. This should be treated as a ${severity.toLowerCase()}-urgency presentation until a clinician reviews the full history, examination findings, and vital signs.`,
    symptomCorrelation,
    clinicalConsiderations,
    immediateActions,
    emergencySigns,
    urgencyRecommendation,
    followUpTimeline,
    confidence,
  };
}

export function buildAssessmentFallback(input: {
  symptoms: string;
  existingConditions?: string;
  allergies?: string;
  currentMedications?: string;
  additionalNotes?: string;
}) {
  const combinedInput = [
    input.symptoms,
    input.existingConditions,
    input.allergies,
    input.currentMedications,
    input.additionalNotes,
  ]
    .filter(Boolean)
    .join(". ");

  const profile = buildClinicalProfile(combinedInput);

  return {
    urgencyLevel: profile.severity,
    clinicalSummary: profile.clinicalSummary,
    symptomCorrelation: profile.symptomCorrelation,
    severityAssessment: profile.urgencyRecommendation,
    confidenceScore: profile.confidence,
    specialistRecommendation: profile.specialist,
    recommendedActions: profile.immediateActions,
    emergencyWarnings: profile.emergencySigns,
    followUpTimeline: profile.followUpTimeline,
  };
}

export function buildChatFallback(
  messages: Array<{ role: "user" | "assistant"; content: string }>
) {
  const userHistory = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(". ");

  const profile = buildClinicalProfile(userHistory);

  return {
    type: "report" as const,
    triage_summary: profile.clinicalSummary,
    symptom_clusters: profile.symptomCorrelation.map((detail, index) => ({
      cluster: titleCase(index === 0 ? "reported symptom pattern" : `clinical signal ${index}`),
      detail,
    })),
    clinical_considerations: profile.clinicalConsiderations,
    risk: {
      severity: profile.severity,
      confidence: profile.confidence,
      urgency_recommendation: profile.urgencyRecommendation,
      emergency_risk:
        profile.severity === "CRITICAL"
          ? "Emergency warning signs may be present."
          : profile.severity === "HIGH"
          ? "Urgency is elevated and should not be delayed."
          : "No immediate emergency pattern is obvious from the text alone.",
    },
    specialists: {
      primary: profile.specialist,
      secondary: profile.secondarySpecialists,
    },
    immediate_actions: profile.immediateActions,
    emergency_signs: profile.emergencySigns,
    followup_timeline: profile.followUpTimeline,
    disclaimer:
      "This triage summary is informational only and does not replace an examination, testing, or advice from a licensed clinician.",
  };
}
