"use client";

import { Suspense } from "react";
import Chat from "@/views/Chat";

export default function ChatRoute() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}

