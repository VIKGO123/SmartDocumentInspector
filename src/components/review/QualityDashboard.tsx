"use client";

import type { QualityReport } from "@/lib/types";

interface QualityDashboardProps {
  quality?: QualityReport;
  fieldsCount: number;
  notesCount: number;
  filename: string;
}

export function QualityDashboard({
  quality,
  fieldsCount,
  notesCount,
}: QualityDashboardProps) {
  const confidence = quality?.extractionConfidence ?? 0;
  const legibility = quality?.pageLegibility ?? 0;
  const textSource = quality?.textSource ?? "digital";
  const handwriting = quality?.handwritingPct ?? 0;
  const edits = quality?.userInput?.edited ?? 0;
  const flagged = quality?.userInput?.flagged ?? 0;
  const rescans = quality?.userInput?.rescans ?? 0;

  const confColor =
    confidence >= 80 ? "#10b981" : confidence >= 50 ? "#f59e0b" : "#ef4444";
  const confStatus =
    confidence >= 80 ? "High Accuracy" : confidence >= 50 ? "Moderate Accuracy" : "Needs Review";

  // SVG circle calculations: radius = 34, circumference = 2 * PI * 34 ~= 213.6
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - Math.min(Math.max(confidence, 0), 100) / 100);

  return (
    <div className="quality-dashboard">
      {/* Overall Score Hero Card */}
      <div className="quality-hero-card">
        <div className="hero-score-wrapper">
          <svg width="84" height="84" viewBox="0 0 84 84" className="score-svg">
            <circle
              cx="42"
              cy="42"
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="6"
            />
            <circle
              cx="42"
              cy="42"
              r={radius}
              fill="none"
              stroke={confColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 42 42)"
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <div className="score-center-text">
            <span className="score-num" style={{ color: confColor }}>
              {confidence}%
            </span>
          </div>
        </div>

        <div className="hero-score-details">
          <div
            className="hero-status-tag"
            style={{
              background: `${confColor}18`,
              color: confColor,
              borderColor: `${confColor}40`,
            }}
          >
            <span className="status-dot-sm" style={{ background: confColor }} />
            {confStatus}
          </div>
          <h3 className="hero-title">Extraction Confidence Score</h3>
          <p className="hero-desc">
            {confidence >= 80
              ? "High accuracy extraction from structured text layer and bounding layout."
              : "Some extracted fields may require verification or AI enhancement."}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="quality-metrics-grid">
        <div className="quality-metric-card">
          <div className="metric-header">
            <span className="metric-icon">🔍</span>
            <span className="metric-label">Page Legibility</span>
          </div>
          <div className="metric-value">{legibility}%</div>
          <div className="metric-bar-bg">
            <div className="metric-bar-fill" style={{ width: `${legibility}%`, background: "#3b82f6" }} />
          </div>
        </div>

        <div className="quality-metric-card">
          <div className="metric-header">
            <span className="metric-icon">📄</span>
            <span className="metric-label">Text Source</span>
          </div>
          <div className="metric-value">
            {textSource === "digital" ? "Digital Stream" : "Scanned OCR"}
          </div>
          <p className="metric-subtext">Original document type</p>
        </div>

        <div className="quality-metric-card">
          <div className="metric-header">
            <span className="metric-icon">✍️</span>
            <span className="metric-label">Handwriting</span>
          </div>
          <div className="metric-value">{handwriting}%</div>
          <div className="metric-bar-bg">
            <div
              className="metric-bar-fill"
              style={{ width: `${Math.max(handwriting, 3)}%`, background: "#8b5cf6" }}
            />
          </div>
        </div>

        <div className="quality-metric-card">
          <div className="metric-header">
            <span className="metric-icon">📌</span>
            <span className="metric-label">Extracted Data</span>
          </div>
          <div className="metric-value">{fieldsCount} Fields</div>
          <p className="metric-subtext">{notesCount} unlabeled text notes</p>
        </div>
      </div>

      {/* User Audit Stats */}
      <div className="quality-audit-card">
        <h4 className="audit-card-title">Audit & Revision Stats</h4>
        <div className="audit-stats-row">
          <div className="audit-stat">
            <span className="audit-num">{edits}</span>
            <span className="audit-lbl">User Edits</span>
          </div>
          <div className="audit-stat">
            <span className="audit-num" style={{ color: flagged > 0 ? "#ef4444" : "inherit" }}>
              {flagged}
            </span>
            <span className="audit-lbl">Flagged</span>
          </div>
          <div className="audit-stat">
            <span className="audit-num">{rescans}</span>
            <span className="audit-lbl">Rescans</span>
          </div>
        </div>
      </div>
    </div>
  );
}
