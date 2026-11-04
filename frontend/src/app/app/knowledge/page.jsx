"use client";

import { Suspense } from "react";
import KnowledgeBase from "@/pages/KnowledgeBase";

export default function KnowledgeBaseRoute() {
  return (
    <Suspense fallback={null}>
      <KnowledgeBase />
    </Suspense>
  );
}

