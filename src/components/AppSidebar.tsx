"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/history", label: "History", icon: "📜" },
  { href: "/how-it-works", label: "How It Works", icon: "⚙️" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Header */}
      <header
        className="mobile-header"
        style={{
          display: "none",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "var(--color-surface, #ffffff)",
          borderBottom: "1px solid var(--color-border, #e2e8f0)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Link
          href="/"
          className="sidebar-brand"
          style={{ margin: 0, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}
        >
          <span>📄</span> Document Inspector
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          style={{
            background: "none",
            border: "1px solid var(--color-border, #cbd5e1)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: "1.1rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(2px)",
            zIndex: 99,
          }}
        />
      )}

      {/* Mobile Drawer Content */}
      <div
        className={`mobile-drawer ${mobileMenuOpen ? "is-open" : ""}`}
        style={{
          display: mobileMenuOpen ? "flex" : "none",
          flexDirection: "column",
          position: "fixed",
          top: 57,
          left: 0,
          right: 0,
          background: "var(--color-surface, #ffffff)",
          borderBottom: "1px solid var(--color-border, #e2e8f0)",
          padding: "16px",
          gap: "8px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
          zIndex: 100,
        }}
      >
        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {LINKS.map((link) => {
            const current =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={current ? "page" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: current ? 600 : 500,
                  background: current ? "var(--color-surface-2, #f1f5f9)" : "transparent",
                  color: current ? "var(--color-ink, #0f172a)" : "var(--color-ink-muted, #64748b)",
                }}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <Link href="/" className="sidebar-brand">
          Document Inspector
        </Link>
        <nav className="sidebar-nav">
          {LINKS.map((link) => {
            const current =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
              >
                <span style={{ marginRight: 8 }}>{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <p className="sidebar-foot muted">
          Files stay in this browser. Nothing is uploaded to a server.
        </p>
      </aside>

      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-header {
            display: flex !important;
          }
          .sidebar {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
