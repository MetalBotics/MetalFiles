"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <>
      <Navbar />
      <div
        className="min-h-screen bg-black text-white flex items-center justify-center px-4"
        style={{ fontFamily: "Roboto, sans-serif" }}
      >
        {/* Terminal Grid Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,255,0,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,255,0,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "30px 30px",
          }}
        />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          {/* Error Code */}
          <div className="mb-8">
            <h1
              className="text-7xl md:text-9xl font-bold text-white mb-4"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              404
            </h1>
            <div className="w-32 h-1 bg-white mx-auto"></div>
          </div>

          {/* Error Message */}
          <div className="mb-8">
            <h2
              className="text-3xl md:text-4xl font-bold text-white mb-4"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              Page not found
            </h2>
            <p
              className="text-lg text-gray-400 mb-6 leading-relaxed"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              The page you're looking for doesn't exist or has been moved.
              <br />
              Let's get you back to uploading files securely.
            </p>
          </div>

          {/* File Icon Animation */}
          <div className="mb-8">
            <div className="relative inline-block">
              <svg
                className="w-24 h-24 text-gray-400 animate-pulse"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 border border-red-400 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="matrix-button px-8 py-4 bg-black border-2 border-white text-white hover:bg-white hover:text-black transition-all duration-300"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>Return home</span>
              </div>
            </Link>

            <button
              onClick={() => window.history.back()}
              className="cursor-pointer px-8 py-4 border-2 border-gray-500 text-gray-400 font-semibold hover:border-white hover:text-white transition-all duration-300"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Go back</span>
              </div>
            </button>
          </div>

          {/* Additional Help */}
          <div className="mt-12 pt-8 border-t border-white">
            <p
              className="text-sm text-gray-400 mb-4"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              Need help? Here are some quick links:
            </p>
            <div
              className="flex flex-wrap justify-center gap-6 text-sm"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              <Link
                href="/"
                className="text-white hover:text-green-400 transition-colors duration-200"
              >
                [FILE UPLOAD]
              </Link>
              <span className="text-gray-600">•</span>
              <a
                href="mailto:contact@metalbotics.tech"
                className="text-white hover:text-green-400 transition-colors duration-200"
              >
                [SUPPORT]
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
