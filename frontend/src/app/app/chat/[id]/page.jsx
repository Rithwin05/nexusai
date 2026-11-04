"use client";

import { Suspense } from "react";
import Chat from "@/views/Chat";

export default function ChatDetailRoute() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}

