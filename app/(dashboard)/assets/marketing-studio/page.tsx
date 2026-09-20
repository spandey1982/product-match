import { redirect } from "next/navigation";

// / assets/marketing-studio has nothing of its own to show yet — one tool
// exists, so land there directly. Once a second tool ships, this becomes a
// real picker instead of a redirect.
export default function MarketingStudioIndexPage() {
  redirect("/assets/marketing-studio/presenter-reel");
}
