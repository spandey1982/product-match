import { Suspense } from "react";
import { LoginView } from "./LoginView";

export const metadata = { title: "Sign in — Home Material Intelligence" };

export default function MaterialsLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}
