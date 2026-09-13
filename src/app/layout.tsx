import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Roboto_Slab } from "next/font/google";
import { AppSidebar } from "@/components/AppSidebar";
import { ClientProviders } from "@/components/ClientProviders";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-loaded",
});

const slab = Roboto_Slab({
  subsets: ["latin"],
  variable: "--font-heading-loaded",
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: "Document Inspector",
  description: "Turn messy documents into structured, queryable data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${slab.variable} ${plex.variable}`}>
      <body>
        <ClientProviders>
          <div className="app-shell">
            <AppSidebar />
            <div className="app-main">{children}</div>
          </div>
        </ClientProviders>
      </body>
    </html>
  );
}
