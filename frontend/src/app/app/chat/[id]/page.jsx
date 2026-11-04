"use client";

import { Suspense } from "react";
import Chat from "@/pages/Chat";

export default function ChatDetailRoute() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}

