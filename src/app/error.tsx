"use client";

import { useEffect } from "react";

export default function Error({
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-500"
        aria-hidden="true"
      >
        !
      </div>
      <h1 className="mb-1 text-lg font-bold text-gray-800">Something went wrong</h1>
      <p className="mb-6 max-w-sm text-sm text-gray-500">
        An unexpected error occurred. You can try again, or return to the login page.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition"
        >
          Try again
        </button>
        <a
          href="/login"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Go to login
        </a>
      </div>
    </div>
  );
}
