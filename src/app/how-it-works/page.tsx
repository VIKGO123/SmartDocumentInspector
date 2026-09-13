"use client";

import Link from "next/link";
import { useCloudAssist } from "@/lib/hooks/useCloudAssist";
import { useToast } from "@/components/ui/ToastProvider";

export default function HowItWorksPage() {
  const [cloudEnabled, setCloudEnabled] = useCloudAssist();
  const { toast } = useToast();

  const handleToggle = (checked: boolean) => {
    setCloudEnabled(checked);
    if (checked) {
      toast.success(
        "Gemini AI enabled for document enhancement.",
        "Cloud Assist Active",
      );
    } else {
      toast.info(
        "All extractions run 100% locally in browser.",
        "Cloud Assist Disabled",
      );
    }
  };

  return (
    <div
      className="page-pad"
      style={{
        maxWidth: 1040,
        margin: "0 auto",
        paddingTop: "var(--space-5, 24px)",
        paddingBottom: "var(--space-6, 40px)",
      }}
    >
      <header style={{ marginBottom: "var(--space-5, 28px)", textAlign: "left" }}>
        <span
          style={{
            fontSize: "0.8rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: "var(--color-primary, #3b82f6)",
          }}
        >
          Core Mission &amp; Architecture
        </span>
        <h1 style={{ margin: "6px 0 12px 0", fontSize: "2.2rem", fontWeight: 700 }}>
          Turning Messy Documents into Structured, Queryable Data
        </h1>
        <p className="muted" style={{ fontSize: "1.05rem", lineHeight: 1.6, maxWidth: 820 }}>
          Real-world business documents arrive unstructured or semi-structured—scanned receipts, multi-column invoices, unformatted resumes, and complex contracts. Document Inspector takes this messy, raw input and converts it into clean, typed, and searchable data that can be queried and exported effortlessly, all while maintaining 100% local privacy in your browser.
        </p>
      </header>

      {/* Problem vs Solution Callout Card */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
          marginBottom: "var(--space-5, 28px)",
        }}
      >
        <div
          style={{
            background: "rgba(239, 68, 68, 0.04)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 12,
            padding: "20px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: "1.25rem" }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#991b1b" }}>
              The Problem: Messy &amp; Unstructured Input
            </h3>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.55 }}>
            Data is trapped in static PDFs, scanned images, and inconsistent formats without standard schemas. Querying, searching, or integrating them into databases requires hours of error-prone manual transcription.
          </p>
        </div>

        <div
          style={{
            background: "rgba(34, 197, 94, 0.04)",
            border: "1px solid rgba(34, 197, 94, 0.2)",
            borderRadius: 12,
            padding: "20px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: "1.25rem" }}>✅</span>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#166534" }}>
              The Solution: Clean, Queryable &amp; Exportable Data
            </h3>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.55 }}>
            An intelligent pipeline that analyzes spatial layouts, infers schema-free field trees with AI, audits confidence, and provides full-text search and direct export into JSON, CSV, and Excel (.xlsx) formats.
          </p>
        </div>
      </section>

      {/* Cloud Assist Quick Toggle Banner */}
      <section
        style={{
          background: "linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(147, 51, 234, 0.06) 100%)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: 14,
          padding: "20px 24px",
          marginBottom: "var(--space-6, 36px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", display: "flex", alignItems: "center", gap: 10 }}>
              <span>✨ Gemini 3.6 Flash Cloud Assist</span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 10px",
                  borderRadius: 12,
                  background: cloudEnabled ? "#dcfce7" : "#f1f5f9",
                  color: cloudEnabled ? "#15803d" : "#64748b",
                  fontWeight: 600,
                }}
              >
                {cloudEnabled ? "ENABLED" : "DISABLED"}
              </span>
            </h3>
            <p className="muted" style={{ margin: "6px 0 0 0", fontSize: "0.9rem" }}>
              Enable AI-driven schema-free recursive section &amp; entry extraction using Gemini 3.6 Flash.
            </p>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontWeight: 600 }}>
            <span style={{ fontSize: "0.9rem" }}>{cloudEnabled ? "Active" : "Inactive"}</span>
            <input
              type="checkbox"
              checked={cloudEnabled}
              onChange={(e) => handleToggle(e.target.checked)}
              style={{ width: 22, height: 22, cursor: "pointer", accentColor: "#3b82f6" }}
            />
          </label>
        </div>
      </section>

      {/* 5-Step Pipeline Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          marginBottom: "56px",
          width: "100%",
          clear: "both",
        }}
      >
        {/* Step 1 */}
        <article
          className="card"
          style={{
            padding: "24px",
            borderRadius: 12,
            border: "1px solid var(--color-border, #e2e8f0)",
            background: "var(--color-bg-card, #ffffff)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "1.6rem" }}>📄</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>STEP 01</span>
          </div>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem" }}>1. Drop Any Document or Scan</h3>
          <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.55, margin: 0 }}>
            Simply upload your PDFs, scanned receipts, photos, Word documents, or text notes. The system reads both digital text and scanned images right inside your browser with complete privacy—no files ever leave your device.
          </p>
        </article>

        {/* Step 2 */}
        <article
          className="card"
          style={{
            padding: "24px",
            borderRadius: 12,
            border: "1px solid var(--color-border, #e2e8f0)",
            background: "var(--color-bg-card, #ffffff)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "1.6rem" }}>📐</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>STEP 02</span>
          </div>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem" }}>2. Understand Visual Layout &amp; Reading Flow</h3>
          <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.55, margin: 0 }}>
            Real-world documents are messy and multi-column. The system automatically detects headings, paragraphs, tables, and lists to understand the natural reading flow, grouping related pieces of information together just like a human reader would.
          </p>
        </article>

        {/* Step 3 */}
        <article
          className="card"
          style={{
            padding: "24px",
            borderRadius: 12,
            border: "1px solid var(--color-border, #e2e8f0)",
            background: "var(--color-bg-card, #ffffff)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "1.6rem" }}>✨</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>STEP 03</span>
          </div>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem" }}>3. Smart AI Turns Chaos into Clean Fields</h3>
          <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.55, margin: 0 }}>
            No rigid templates needed. AI automatically identifies the type of document (Invoice, Resume, Receipt, Contract, or Form) and turns unstructured paragraphs into neatly organized, labeled fields, line items, and section summaries.
          </p>
        </article>

        {/* Step 4 */}
        <article
          className="card"
          style={{
            padding: "24px",
            borderRadius: 12,
            border: "1px solid var(--color-border, #e2e8f0)",
            background: "var(--color-bg-card, #ffffff)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "1.6rem" }}>🛡️</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>STEP 04</span>
          </div>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem" }}>4. Quality Checks &amp; Visual Source Highlights</h3>
          <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.55, margin: 0 }}>
            Every extracted detail is checked for accuracy (such as valid dates, amounts, and contact info) and assigned a reliability score. Hover over any field to instantly highlight exactly where that information appears on the original document.
          </p>
        </article>

        {/* Step 5 */}
        <article
          className="card"
          style={{
            padding: "24px",
            borderRadius: 12,
            border: "1px solid var(--color-border, #e2e8f0)",
            background: "var(--color-bg-card, #ffffff)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "1.6rem" }}>📊</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em" }}>STEP 05</span>
          </div>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem" }}>5. Search, Review &amp; Export Anywhere</h3>
          <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.55, margin: 0 }}>
            Easily review, correct, or search across all your saved documents in one place. When you are ready, download your clean data with a single click as structured JSON, a CSV spreadsheet, or a ready-to-share Excel (.xlsx) workbook.
          </p>
        </article>
      </div>

      {/* Prominent Dashboard CTA with Generous Spacing */}
      <footer
        style={{
          marginTop: "56px",
          paddingTop: "32px",
          paddingBottom: "48px",
          borderTop: "1px solid var(--color-border, #e2e8f0)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          width: "100%",
          clear: "both",
        }}
      >
        <p className="muted" style={{ margin: 0, fontSize: "1rem" }}>
          Ready to turn messy documents into structured, queryable data?
        </p>
        <Link
          href="/"
          className="primary-btn"
          style={{
            padding: "14px 36px",
            fontSize: "1.05rem",
            fontWeight: 600,
            borderRadius: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 4px 14px rgba(59, 130, 246, 0.25)",
            textDecoration: "none",
          }}
        >
          <span>Go to Dashboard</span>
          <span>→</span>
        </Link>
      </footer>
    </div>
  );
}
