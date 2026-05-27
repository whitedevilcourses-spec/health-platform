import mongoose from "mongoose";

declare global {
  var __mongooseConnection:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
}

const globalStore = globalThis.__mongooseConnection ?? {
  conn: null,
  promise: null,
};

globalThis.__mongooseConnection = globalStore;

export async function connectToDatabase() {
  if (globalStore.conn) {
    return globalStore.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!globalStore.promise) {
    globalStore.promise = mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || "healthcare_platform",
    });
  }

  globalStore.conn = await globalStore.promise;
  return globalStore.conn;
}
