import { Suspense } from "react";
import { UploadView } from "./UploadView";

export const metadata = { title: "Upload Room — Home Material Intelligence" };

export default function MaterialsUploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadView />
    </Suspense>
  );
}
