// Used by pages to call this app's own API routes as the signed-in user.
import { User } from "firebase/auth";

export interface ApiResult {
  ok: boolean;
  message?: string;
  error?: string;
  details?: string[];
}

export async function callApi(user: User, method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<ApiResult> {
  try {
    // The ID token proves to the server who is calling. It is short-lived and
    // refreshed automatically.
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = (await response.json()) as ApiResult;
    return { ...result, ok: response.ok && result.ok !== false };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

// One readable line from a failed result.
export function apiError(result: ApiResult): string {
  const details = result.details && result.details.length ? ` ${result.details.join(". ")}.` : "";
  return `${result.error ?? "Something went wrong."}${details}`;
}
