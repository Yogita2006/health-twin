// Shared by every API route: works out who is calling from their Firebase ID token.
import { adminAuth } from "@/lib/firebase/admin";

export type Caller = { uid: string } | { error: string };

export async function callerFromRequest(request: Request): Promise<Caller> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Sign in first." };

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return { error: "Your session is not valid. Sign in again." };
  }
}
