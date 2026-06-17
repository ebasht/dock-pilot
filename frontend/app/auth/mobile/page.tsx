import { Suspense } from "react";
import MobileAuthClient from "./MobileAuthClient";

export default function MobileAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-screen">
          <div className="card auth-card mobile-auth-card" />
        </div>
      }
    >
      <MobileAuthClient />
    </Suspense>
  );
}
