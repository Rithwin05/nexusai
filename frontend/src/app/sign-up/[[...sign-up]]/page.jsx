"use client";

import { SignUp } from "@clerk/nextjs";
import AuthPage from "@/pages/AuthPage";

export default function SignUpPage() {
  return (
    <AuthPage>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthPage>
  );
}

