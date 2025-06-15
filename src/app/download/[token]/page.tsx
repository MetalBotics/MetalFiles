"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { FileEncryption } from "../../utils/encryption";

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

      // Get encrypted data and decryption info from response
      const encryptedData = await response.arrayBuffer();
      setDownloadProgress(60); // Data downloaded

      const encryptionKey = response.headers.get("X-Encryption-Key");
      const iv = response.headers.get("X-IV");
      const salt = response.headers.get("X-Salt");
      const originalName = decodeURIComponent(
        response.headers.get("X-Original-Name") || "download"
      );

      if (!encryptionKey || !iv || !salt) {
        throw new Error("Missing decryption metadata");
      }

      setDownloadProgress(70); // Starting decryption

      // Decode base64 encoded IV and salt
      const ivArray = new Uint8Array(
        atob(iv)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
      const saltArray = new Uint8Array(
        atob(salt)
          .split("")
          .map((c) => c.charCodeAt(0))
      );

      // Decrypt the file client-side
      const decryptedData = await FileEncryption.decryptFile(
        encryptedData,
        encryptionKey,
        ivArray,
        saltArray
      );

      setDownloadProgress(90); // Decryption complete

      // Create blob and download the decrypted file
      const blob = new Blob([decryptedData]);
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
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p
              className="text-white"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              Loading file information...
            </p>
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
        <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-8">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
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
            <h1
              className="text-2xl font-bold text-white mb-4"
              style={{ fontFamily: "Orbitron, monospace" }}
            >
              File Not Found
            </h1>
            <p
              className="text-gray-400 mb-6"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              {error || "The download link is invalid or has expired."}
            </p>
            <a
              href="/"
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors duration-200"
              style={{ fontFamily: "Roboto, sans-serif" }}
            >
              Go Back Home
            </a>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-40 right-20 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative pt-20 pb-20">
          <div className="max-w-2xl mx-auto px-6">
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-blue-400"
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
                </div>
                <h1
                  className="text-3xl font-bold text-white mb-2"
                  style={{ fontFamily: "Orbitron, monospace" }}
                >
                  File Download
                </h1>
                <p
                  className="text-gray-400"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  Your file is ready for download
                </p>
              </div>

              {/* File Info */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700/30 p-6 mb-8">
                <div className="flex items-start justify-between mb-4">                  <div className="flex-1 min-w-0 pr-4">                    <h2
                      className="text-xl font-semibold text-white mb-2 break-words overflow-wrap-anywhere hyphens-auto"
                      style={{ 
                        fontFamily: "Roboto, sans-serif",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere"
                      }}
                      title={fileInfo.originalName}
                    >
                      {fileInfo.originalName}
                    </h2>
                    <p className="text-gray-400 text-sm">
                      Size: {formatFileSize(fileInfo.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Valid
                  </div>
                </div>
                <div className="text-gray-400 text-sm">
                  <strong>Expires:</strong>{" "}
                  {new Date(fileInfo.expiresAt).toLocaleString()}
                </div>
              </div>

              {/* Download Button */}
              <div className="text-center">
                {" "}
                <button
                  onClick={() => handleDownload()}
                  disabled={downloading}
                  className="inline-flex items-center px-8 py-4 text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  {" "}
                  {downloading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                        ? `Processing... ${downloadProgress}%`
                        : "Downloading..."}
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
                      Download File
                    </>
                  )}
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p
                    className="text-red-400 text-sm"
                    style={{ fontFamily: "Roboto, sans-serif" }}
                  >
                    {error}
                  </p>
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
