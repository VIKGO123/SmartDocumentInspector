"use client";

import React from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | number;
  color?: string;
  label?: string;
  className?: string;
}

export function Spinner({
  size = "md",
  color = "currentColor",
  label = "Loading...",
  className = "",
}: SpinnerProps) {
  const pixelSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 14
      : size === "lg"
      ? 28
      : 18;

  return (
    <span
      className={`ui-spinner ${className}`}
      role="status"
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
      }}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: "uiSpin 0.75s linear infinite",
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3"
          strokeOpacity="0.25"
        />
        <path
          d="M12 2C6.47715 2 2 6.47715 2 12C2 14.2407 2.73815 16.3087 3.9856 17.9736"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, padding: 0, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        {label}
      </span>
    </span>
  );
}
