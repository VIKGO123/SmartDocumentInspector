"use client";

import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = 6,
  className = "",
  style = {},
}: SkeletonProps) {
  return (
    <div
      className={`ui-skeleton ${className}`}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, var(--color-surface-2, #f1f5f9) 25%, var(--color-border, #e2e8f0) 50%, var(--color-surface-2, #f1f5f9) 75%)",
        backgroundSize: "200% 100%",
        animation: "uiShimmer 1.5s infinite linear",
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        padding: "var(--space-4, 16px)",
        borderRadius: 12,
        border: "1px solid var(--color-border, #e2e8f0)",
        background: "var(--color-bg-card, #ffffff)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <Skeleton width="40%" height="1.25rem" />
      <Skeleton width="85%" height="0.9rem" />
      <Skeleton width="60%" height="0.9rem" />
    </div>
  );
}

export function SkeletonTableRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid var(--color-border, #f1f5f9)",
            background: "var(--color-bg-card, #ffffff)",
          }}
        >
          <Skeleton width="25%" height="1rem" />
          <Skeleton width="50%" height="1rem" />
          <Skeleton width="15%" height="1rem" style={{ marginLeft: "auto" }} />
        </div>
      ))}
    </div>
  );
}
