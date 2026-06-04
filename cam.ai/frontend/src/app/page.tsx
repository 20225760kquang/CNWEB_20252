import { redirect } from "next/navigation";

/**
 * Root route `/` → redirects to /dashboard.
 * Proxy will catch unauthenticated users and redirect them to /login.
 */
export default function RootPage() {
  redirect("/dashboard");
}
