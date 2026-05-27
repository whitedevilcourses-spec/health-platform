import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export function hasConfiguredAiProvider() {
  return Boolean(openaiClient || geminiClient);
}

export async function generateStructuredJson<T>(system: string, prompt: string): Promise<T> {
  if (openaiClient) {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_TRIAGE_MODEL || "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }
    return JSON.parse(content) as T;
  }

  if (geminiClient) {
    const model = geminiClient.getGenerativeModel({
      model: process.env.GEMINI_TRIAGE_MODEL || "gemini-1.5-pro",
    });
    const response = await model.generateContent(
      `${system}\n\n${prompt}\n\nReturn only valid JSON.`
    );
    return JSON.parse(response.response.text().replace(/```json|```/g, "").trim()) as T;
  }

  throw new Error("No AI provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
}
