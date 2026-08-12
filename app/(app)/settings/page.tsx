import { redirect } from "next/navigation";

/** Old Settings URL — keep bookmarks working. */
export default function SettingsRedirectPage() {
  redirect("/staff");
}
