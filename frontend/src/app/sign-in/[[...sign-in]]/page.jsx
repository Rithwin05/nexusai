"use client";

import { SignIn } from "@clerk/nextjs";
import AuthPage from "@/views/AuthPage";

export default function SignInPage() {
  return (
    <AuthPage>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </AuthPage>
  );
}

