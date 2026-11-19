// POST /api/account/admin   { displayName, key }
// Finishes registration for an administrator. The caller has just created a
// login; this route gives it the admin role only if the key matches the
// ADMIN_SETUP_KEY environment variable. The key is known only to the site
// owner, lives outside the code, and is never sent to the browser.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail, jsonBody } from "@/lib/api/auth";
import { adminSignupInput } from "@/lib/validation/profile";

// Compares two strings without revealing, through timing, how much of the key was right.
function sameKey(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  const parsed = adminSignupInput.safeParse(await jsonBody(request));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "Check the form.");

  const expected = process.env.ADMIN_SETUP_KEY ?? "";
  if (expected.length < 12) {
    return fail(503, "Administrator sign-up is switched off. The site owner has not set an admin key.");
  }
  if (!sameKey(parsed.data.key, expected)) return fail(403, "That admin key is not correct.");

  try {
    const db = adminDb();
    const userRef = db.collection("users").doc(caller.uid);
    // This route only finishes a brand-new registration. It never changes an existing account.
    if ((await userRef.get()).exists) return fail(409, "This account is already set up.");

    const account = await adminAuth().getUser(caller.uid);
    await userRef.set({
      email: account.email ?? "",
      displayName: parsed.data.displayName,
      role: "admin",
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin sign-up failed:", err);
    return fail(500, "The server could not finish the registration. Check the server log.");
  }
}
