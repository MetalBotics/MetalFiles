"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center px-4">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(90deg, #00ff00 1px, transparent 1px),
            linear-gradient(#00ff00 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />
      <div className="max-w-2xl mx-auto text-center relative z-10">
        {/* Error Icon */}
        <div className="mb-8">
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-black border-2 border-red-500 flex items-center justify-center mb-4">
              <svg
                className="w-12 h-12 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
          <div className="w-32 h-1 bg-red-500 mx-auto"></div>
        </div>

        {/* Error Message */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-red-500 mb-4 font-mono">
            SYSTEM ERROR
          </h1>
          <p className="text-lg text-red-400 mb-6 leading-relaxed font-mono">
            UNEXPECTED ERROR WHILE PROCESSING REQUEST.
            <br />
            DON'T WORRY, YOUR FILES ARE SAFE.
          </p>

          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="mb-6 p-4 bg-black border-2 border-red-500 rounded-none text-left">
              <h3 className="text-red-400 font-semibold mb-2 font-mono">
                ERROR DETAILS:
              </h3>
              <code className="text-sm text-red-300 break-all font-mono">
                {error.message}
              </code>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <button onClick={reset} className="matrix-button px-8 py-4 font-mono">
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              <span>TRY AGAIN</span>
            </div>
          </button>

          <button
            onClick={() => (window.location.href = "/")}
            className="px-8 py-4 border-2 border-green-500 text-green-400 font-semibold rounded-none hover:border-green-400 hover:text-green-300 transition-all duration-300 font-mono"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              <span>RETURN HOME</span>
            </div>
          </button>
        </div>

        {/* Help Information */}
        <div className="mt-8 pt-6 border-t border-green-500">
          <h3 className="text-lg font-semibold text-green-500 mb-4 font-mono">
            TROUBLESHOOTING OPTIONS
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-green-400 font-mono">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-black border border-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-400 text-xs font-bold">1</span>
              </div>
              <div>
                <p className="font-medium text-green-300">REFRESH PAGE</p>
                <p>SOMETIMES A SIMPLE REFRESH SOLVES THE ISSUE</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-black border border-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-400 text-xs font-bold">2</span>
              </div>
              <div>
                <p className="font-medium text-green-300">CHECK CONNECTION</p>
                <p>ENSURE YOU HAVE A STABLE INTERNET CONNECTION</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-black border border-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-green-400 text-xs font-bold">3</span>
              </div>
              <div>
                <p className="font-medium text-green-300">CONTACT SUPPORT</p>
                <p>IF THE ISSUE PERSISTS, LET US KNOW</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-green-400 mb-2 font-mono">
            STILL HAVING TROUBLE?
          </p>
          <a
            href="mailto:contact@metalbotics.tech"
            className="text-green-500 hover:text-green-300 transition-colors duration-200 text-sm font-mono"
          >
            [CONTACT SUPPORT →
          </a>
        </div>
      </div>
    </div>
  );
}
