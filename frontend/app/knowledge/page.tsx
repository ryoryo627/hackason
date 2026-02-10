"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KnowledgeRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/agents?tab=knowledge");
  }, [router]);

  return null;
}
