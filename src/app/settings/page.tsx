"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
export { CLOUD_ASSIST_KEY } from "@/lib/constants";

export default function SettingsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/how-it-works");
  }, [router]);

  return null;
}
