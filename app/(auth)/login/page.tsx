import { Suspense } from "react";
import { LoginView } from "./LoginView";

export const metadata = { title: "Sign in — Mentis" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}
