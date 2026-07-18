import { redirect } from "next/navigation";

/** Legacy path — full flow lives at /onboarding */
export default function OnboardingSeguirRedirect() {
  redirect("/onboarding");
}
