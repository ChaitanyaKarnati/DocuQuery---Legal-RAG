import OpenAI from "openai";
import { getEnv } from "./env";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    const env = getEnv();
    client = new OpenAI({
      apiKey: env.openaiApiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }

  return client;
}
