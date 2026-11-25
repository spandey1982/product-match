import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/mentis-coming-soon/ComingSoonPage";

const TITLE = "Mentis: On-Demand STEM Mentor At-Home. Coming Soon";
const DESCRIPTION = "Mentis: learning, delivered in 30 minutes. On-demand STEM mentoring at home, coming soon.";

// The fashion platform's homepage now lives at /mentis/fashion.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { title: TITLE, description: DESCRIPTION },
};

export default function RootPage() {
  return <ComingSoonPage />;
}
