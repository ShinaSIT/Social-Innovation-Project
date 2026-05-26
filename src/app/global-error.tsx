"use client";

import { useEffect } from "react";

// global-error replaces the root layout, so it must render its own <html>/<body>
// and cannot rely on global styles being applied.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f9fafb",
          color: "#1f2937",
          textAlign: "center",
          padding: "1.5rem",
          margin: 0,
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.5rem" }}>
          A critical error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#14b8a6",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
