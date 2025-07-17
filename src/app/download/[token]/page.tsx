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
        <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center">
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(90deg, #00ff00 1px, transparent 1px),
                linear-gradient(#00ff00 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
          <div className="text-center relative z-10">
            <div className="animate-spin text-green-500 mx-auto mb-4">
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
            <p className="text-green-400 font-mono">
              SCANNING FILE MATRIX...
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
        <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center">
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(90deg, #00ff00 1px, transparent 1px),
                linear-gradient(#00ff00 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
          <div className="max-w-md mx-auto text-center p-8 relative z-10">
            <div className="w-16 h-16 bg-red-900 border-2 border-red-500 flex items-center justify-center mx-auto mb-6">
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
            <h1 className="text-2xl font-bold text-red-500 mb-4 font-mono">
              [FILE_NOT_FOUND]
            </h1>
            <p className="text-red-400 mb-6 font-mono">
              {error || "THE DOWNLOAD LINK IS INVALID OR HAS EXPIRED."}
            </p>
            <a
              href="/"
              className="matrix-button px-6 py-3 font-mono"
            >
              [RETURN_HOME]
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
      <div className="min-h-screen bg-black text-green-500 font-mono">
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(90deg, #00ff00 1px, transparent 1px),
              linear-gradient(#00ff00 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }}
        />

        <div className="relative pt-20 pb-20 z-10">
          <div className="max-w-2xl mx-auto px-6">
            <div className="bg-black border-2 border-green-500 p-8 rounded-none">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-black border-2 border-green-400 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-400"
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
                <h1 className="text-3xl font-bold text-green-500 mb-2 font-mono">
                  {"> FILE_DOWNLOAD_INTERFACE"}
                </h1>
                <p className="text-green-400 font-mono">
                  YOUR FILE IS READY FOR DOWNLOAD
                </p>
              </div>

              {/* File Info */}
              <div className="bg-black border border-green-400 p-6 mb-8 rounded-none">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <h2 className="text-xl font-semibold text-green-500 mb-2 break-words font-mono"
                      style={{ 
                        wordBreak: "break-word",
                        overflowWrap: "anywhere"
                      }}
                      title={fileInfo.originalName}
                    >
                      {fileInfo.originalName}
                    </h2>
                    <p className="text-green-300 text-sm font-mono">
                      SIZE: {formatFileSize(fileInfo.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
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
                    [VALID]
                  </div>
                </div>
                <div className="text-green-300 text-sm font-mono">
                  <strong>EXPIRES:</strong>{" "}
                  {new Date(fileInfo.expiresAt).toLocaleString()}
                </div>
              </div>

              {/* Download Button */}
              <div className="text-center">
                <button
                  onClick={() => handleDownload()}
                  disabled={downloading}
                  className="matrix-button px-8 py-4 text-lg font-mono"
                >
                  {downloading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-green-500"
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
                      [DOWNLOAD_FILE]
                    </>
                  )}
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-6 p-4 bg-black border-2 border-red-500 rounded-none">
                  <p className="text-red-400 text-sm font-mono">
                    [ERROR]: {error}
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
