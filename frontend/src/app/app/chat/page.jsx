"use client";

import { Suspense } from "react";
import Chat from "@/pages/Chat";

export default function ChatRoute() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}

