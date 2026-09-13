"use client";

import { DocumentsProvider } from "@/lib/store/DocumentsProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <DocumentsProvider>{children}</DocumentsProvider>
    </ToastProvider>
  );
}
