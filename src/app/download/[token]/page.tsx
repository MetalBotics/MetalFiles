"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

interface FileInfo {
  originalName: string;
  size: number;
  expiresAt: string;
  isValid: boolean;
}

export default function DownloadPage() {
  const params = useParams();
  const token = params.token as string;
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (token) {
      fetchFileInfo();
    }
  }, [token]);
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const fetchFileInfo = async (retryCount = 0) => {
    try {
      const response = await fetch(`/api/file-info/${token}`);
      const data = await response.json();

      if (response.ok) {
        setFileInfo(data);
        setError(null); // Clear any previous errors
      } else {
        // For 404 or 410 (expired), don't retry and show user-friendly message
        if (response.status === 404 || response.status === 410) {
          setError("The download link is invalid or has expired.");
          setLoading(false);
          return;
        }

        // For other errors, retry once
        if (retryCount < 1) {
          console.log("API error, retrying in 500ms...");
          setTimeout(() => fetchFileInfo(retryCount + 1), 500);
          return;
        }

        // After retry, show user-friendly message
        setError("The download link is invalid or has expired.");
      }
    } catch (err) {
      // Network error - retry once after a short delay
      if (retryCount < 1) {
        console.log("Network error, retrying in 500ms...");
        setTimeout(() => fetchFileInfo(retryCount + 1), 500);
        return;
      }
      // After retry, show user-friendly message
      setError("The download link is invalid or has expired.");
    } finally {
      // Only set loading to false if we're not going to retry
      if (retryCount >= 1 || !error) {
        setLoading(false);
      }
    }
  };
  const handleDownload = async (retryCount = 0) => {
    if (!token) return;

    setDownloading(true);
    setDownloadProgress(0);
    try {
      setDownloadProgress(10); // Starting download
      const response = await fetch(`/api/file/${token}`);

      if (!response.ok) {
        // For 404 or 410 (expired), don't retry and show user-friendly message
        if (response.status === 404 || response.status === 410) {
          throw new Error("The download link is invalid or has expired.");
        }

        // For other errors, retry once
        if (retryCount < 1) {
          console.log("Download failed, retrying in 500ms...");
          setDownloading(false);
          setTimeout(() => handleDownload(retryCount + 1), 500);
          return;
        }

        // After retry, show user-friendly message
        throw new Error("The download link is invalid or has expired.");
      }

      setDownloadProgress(30); // Response received

      // Get file data from response
      const fileData = await response.arrayBuffer();
      setDownloadProgress(80); // Data downloaded

      const originalName = decodeURIComponent(
        response.headers.get("X-Original-Name") || "download"
      );

      // Create blob and download the file
      const blob = new Blob([fileData]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadProgress(100); // Complete
    } catch (err) {
      // For token-related errors, show consistent message
      if (
        err instanceof Error &&
        (err.message.includes("Invalid download token") ||
          err.message.includes("expired") ||
          err.message.includes("invalid"))
      ) {
        setError("The download link is invalid or has expired.");
      } else {
        setError(err instanceof Error ? err.message : "Download failed");
      }
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black relative overflow-hidden">
          {/* Matrix-style Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-32 h-32 bg-green-500/20 blur-2xl"></div>
            <div className="absolute top-40 right-20 w-48 h-48 bg-green-400/10 blur-3xl"></div>
            <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-green-600/15 blur-2xl"></div>
          </div>

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
          ></div>

          <div className="relative z-10 flex items-center justify-center min-h-screen">
            <div
              className="text-center"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              <div className="animate-spin origin-center inline-block text-green-500 mx-auto mb-4">
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <p className="text-green-400 text-lg">
                Loading file information...
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (error || !fileInfo?.isValid) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-black relative overflow-hidden">
          {/* Matrix-style Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-32 h-32 bg-green-500/20 blur-2xl"></div>
            <div className="absolute top-40 right-20 w-48 h-48 bg-green-400/10 blur-3xl"></div>
            <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-green-600/15 blur-2xl"></div>
          </div>

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
          ></div>

          <div className="relative z-10 flex items-center justify-center min-h-screen">
            <div
              className="max-w-md mx-auto text-center p-8"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              <div className="w-16 h-16 bg-black border-2 border-red-500 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-red-500 mb-4">
                File Not Found
              </h1>
              <p className="text-gray-300 mb-6">
                {error || "The download link is invalid or has expired."}
              </p>
              <a
                href="/"
                className="matrix-button inline-flex items-center px-6 py-3 text-lg font-bold text-white bg-black border-2 border-white hover:bg-white hover:text-black transition-all duration-200 cursor-pointer tracking-wider"
                style={{ fontFamily: "Roboto, sans-serif" }}
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Matrix-style Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 bg-green-500/20 blur-2xl"></div>
          <div className="absolute top-40 right-20 w-48 h-48 bg-green-400/10 blur-3xl"></div>
          <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-green-600/15 blur-2xl"></div>
        </div>

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
        ></div>

        <div className="max-w-4xl mx-auto px-4 py-12 relative z-10">
          {/* Hero Section */}
          <div
            className="text-center mb-16"
            style={{ fontFamily: "Roboto, sans-serif" }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-wider">
              {">"} SECURE FILE
              <span className="text-green-400"> DOWNLOAD_</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Your file is ready for secure download with enterprise-grade
              decryption.
            </p>
          </div>

          {/* Download Section */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-black border-2 border-green-400/30 p-8">
              {/* File Info */}
              <div className="bg-black border border-green-400 p-6 mb-8">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <h2
                      className="text-xl font-semibold text-white mb-2 break-words"
                      style={{
                        fontFamily: "Roboto, sans-serif",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                      title={fileInfo.originalName}
                    >
                      {fileInfo.originalName}
                    </h2>
                    <p
                      className="text-gray-400 text-sm"
                      style={{ fontFamily: "Roboto, sans-serif" }}
                    >
                      Size: {formatFileSize(fileInfo.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-900/30 text-green-300 border border-green-600/30">
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Valid
                    </span>
                  </div>
                </div>
                <div
                  className="text-gray-400 text-sm"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  <strong>Expires:</strong>{" "}
                  {new Date(fileInfo.expiresAt).toLocaleString()}
                </div>
              </div>

              {/* Download Button */}
              <div className="text-center">
                <button
                  onClick={() => handleDownload()}
                  disabled={downloading}
                  className={`matrix-button inline-flex items-center px-8 py-4 text-lg font-bold ${
                    downloading
                      ? "bg-gray-600 border-gray-500 cursor-not-allowed text-gray-400"
                      : "bg-black border-white text-white hover:bg-white hover:text-black"
                  } border-2 transition-all duration-200 tracking-wider cursor-pointer`}
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  {downloading ? (
                    <>
                      <svg
                        className="animate-spin origin-center inline-block -ml-1 mr-3 h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {downloadProgress > 0
                        ? `PROCESSING... ${downloadProgress}%`
                        : "DOWNLOADING..."}
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      DOWNLOAD FILE
                    </>
                  )}
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-6 bg-red-900/20 border border-red-600/30 p-4 flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-red-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div
                    className="text-red-200 text-sm"
                    style={{ fontFamily: "Roboto, sans-serif" }}
                  >
                    <strong>Error:</strong> {error}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
