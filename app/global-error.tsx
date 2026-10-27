"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [refId, setRefId] = useState<string>("");

  useEffect(() => {
    const ref = error.digest || Math.random().toString(36).substring(2, 8).toUpperCase();
    setRefId(ref);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased font-sans">
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">
              Something went wrong on our side. Please try again. If it continues, contact your admin and share reference ID:{" "}
              <span className="font-mono font-semibold text-gray-900">{refId}</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
              >
                <Home className="w-4 h-4 mr-2" />
                Go home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
