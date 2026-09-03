import "server-only";
import { ApiError } from "@/contracts/errors";

export async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (attempt === 2 || (code !== "P2034" && code !== "40001" && code !== "40P01")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 + attempt * 35));
    }
  }
  throw new ApiError(409, "SERIALIZATION_CONFLICT", "Please try again.");
}
