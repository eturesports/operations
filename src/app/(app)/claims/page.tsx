import { redirect } from "next/navigation";

// Claims moved under the dashboard, where the rest of the analysis lives.
// Anyone with the old address in a bookmark or an email still lands on it.
export default function ClaimsRedirect() {
  redirect("/dashboard/claims");
}
