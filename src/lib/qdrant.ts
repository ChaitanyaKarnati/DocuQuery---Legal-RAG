import { QdrantClient } from "@qdrant/js-client-rest";
import { getEnv } from "./env";

// Gemini embedding model (gemini-embedding-001) produces 3072-dimensional vectors
// when accessed via OpenAI SDK compatibility layer
const VECTOR_SIZE = 3072;

let client: QdrantClient | null = null;
let collectionNameValue: string | null = null;
let collectionReady = false;

function resolveClient(): { client: QdrantClient; collectionName: string } {
  if (!client) {
    const env = getEnv();
    client = new QdrantClient({
      url: env.qdrantUrl,
      apiKey: env.qdrantApiKey || undefined,
    });
    collectionNameValue = env.qdrantCollection;
  }

  if (!collectionNameValue) {
    throw new Error("Failed to resolve Qdrant collection name");
  }

  return { client, collectionName: collectionNameValue };
}

export function getQdrantClient(): QdrantClient {
  return resolveClient().client;
}

export function getCollectionName(): string {
  return resolveClient().collectionName;
}

export async function ensureCollection(): Promise<void> {
  const { client: qdrantClient, collectionName } = resolveClient();

  if (collectionReady) {
    return;
  }

  let needsCreation = false;

  try {
    const collection = await qdrantClient.getCollection(collectionName);
    
    // Check if the collection has the correct vector size
    const collectionVectorSize = collection.config?.params?.vectors?.size;
    if (collectionVectorSize && collectionVectorSize !== VECTOR_SIZE) {
      console.warn(
        `Collection '${collectionName}' has vector size ${collectionVectorSize}, expected ${VECTOR_SIZE}. Recreating collection...`
      );
      try {
        await qdrantClient.deleteCollection(collectionName);
        needsCreation = true;
      } catch (deleteError) {
        console.error(`Failed to delete collection '${collectionName}':`, deleteError);
        throw new Error(`Cannot recreate collection with wrong vector size: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`);
      }
    } else {
      collectionReady = true;
      return;
    }
  } catch (error) {
    // If getCollection fails, collection likely doesn't exist
    if (error instanceof Error && error.message.includes('Not found')) {
      needsCreation = true;
    } else if (!error || (error instanceof Error && !error.message.includes('Cannot recreate'))) {
      // If it's any other error (network, auth, etc), assume we need to create
      needsCreation = true;
    } else {
      // Re-throw if it's our custom error from deletion failure
      throw error;
    }
  }

  if (needsCreation) {
    console.log(`Creating collection '${collectionName}' with vector size ${VECTOR_SIZE}...`);
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
      optimizers_config: {
        default_segment_number: 2,
      },
    });
  }

  collectionReady = true;
}

export const vectorSize = VECTOR_SIZE;
