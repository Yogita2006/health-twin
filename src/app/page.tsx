import { redirect } from "next/navigation";

// The site's front door. It sends everyone to the dashboard, which in turn
// sends anyone who is not signed in to the sign-in page.
export default function Home() {
  redirect("/dashboard");
}
