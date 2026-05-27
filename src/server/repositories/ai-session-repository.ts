import { AISessionModel } from "@/server/models/ai-session";

export async function findAiSessionById(id: string) {
  return AISessionModel.findById(id);
}

export async function createAiSession(data: Parameters<typeof AISessionModel.create>[0]) {
  return AISessionModel.create(data);
}
