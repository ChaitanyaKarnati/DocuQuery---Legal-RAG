import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  QDRANT_URL: z.string().min(1, "QDRANT_URL is required").url("QDRANT_URL must be a valid url"),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().optional(),
  PYTHON_SERVICE_URL: z.string().url("PYTHON_SERVICE_URL must be a valid url").optional(),
});

type Env = {
  openaiApiKey: string;
  qdrantUrl: string;
  qdrantApiKey?: string;
  qdrantCollection: string;
  pythonServiceUrl: string;
};

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  cachedEnv = {
    openaiApiKey: parsed.data.OPENAI_API_KEY,
    qdrantUrl: parsed.data.QDRANT_URL,
    qdrantApiKey: parsed.data.QDRANT_API_KEY,
    qdrantCollection: parsed.data.QDRANT_COLLECTION ?? "legal_docs",
    pythonServiceUrl: parsed.data.PYTHON_SERVICE_URL ?? "http://localhost:8000",
  };

  return cachedEnv;
}
