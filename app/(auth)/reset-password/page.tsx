import { Suspense } from "react";
import { ResetPasswordView } from "./ResetPasswordView";

export const metadata = { title: "Reset password — Mentis" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordView />
    </Suspense>
  );
}
