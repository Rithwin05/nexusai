"use client";

import { Suspense } from "react";
import DocumentDetail from "@/views/DocumentDetail";

export default function DocumentDetailRoute() {
  return (
    <Suspense fallback={null}>
      <DocumentDetail />
    </Suspense>
  );
}

