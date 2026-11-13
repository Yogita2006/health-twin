// Turns Firebase error codes into messages a person can act on.
export function authErrorMessage(err: unknown): string {
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      return "Email/Password sign-in is not enabled in the Firebase Console.";
    case "auth/invalid-api-key":
      return "The Firebase keys are missing or wrong. Check .env.local and restart npm run dev.";
    case "permission-denied":
      return "Permission denied. Check that the Firestore security rules are published.";
    default:
      return "Something went wrong. Please try again.";
  }
}
