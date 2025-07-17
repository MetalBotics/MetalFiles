"use client";

import Image from "next/image";
import Navbar from "./components/Navbar";
import { useState, useRef, useEffect, useReducer } from "react";
import Footer from "./components/Footer";
import { FileEncryption } from "./utils/encryption";
import { UploadDiagnostics } from "./utils/uploadDiagnostics";
import { ChunkedUpload } from "./utils/chunkedUpload";
import NoSSR from "./components/NoSSR";

// Suppress hydration warnings in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Hydration failed") ||
        args[0].includes("hydrated but some attributes") ||
        args[0].includes("data-cnp-create-listener"))
    ) {
      return;
    }
    originalError(...args);
  };
}

type DownloadUrl = {
  id: string;
  fileName: string;
  downloadUrl: string;
  expiresAt: string;
};

type DownloadUrlAction =
  | { type: "ADD"; payload: DownloadUrl }
  | { type: "REMOVE"; payload: string }
  | { type: "CLEAR" }
  | { type: "SET"; payload: DownloadUrl[] };

function downloadUrlsReducer(
  state: DownloadUrl[],
  action: DownloadUrlAction
): DownloadUrl[] {
  console.log(
    "Reducer called:",
    action.type,
    "payload" in action ? action.payload : "no payload"
  );
  console.log(
    "Current state:",
    state.map((item) => ({ id: item.id, fileName: item.fileName }))
  );

  switch (action.type) {
    case "ADD":
      const newState = state
        .filter((item) => item.id !== action.payload.id)
        .concat(action.payload);
      console.log(
        "After ADD:",
        newState.map((item) => ({ id: item.id, fileName: item.fileName }))
      );
      return newState;
    case "REMOVE":
      const filtered = state.filter((item) => item.id !== action.payload);
      console.log(
        "After REMOVE:",
        filtered.map((item) => ({ id: item.id, fileName: item.fileName }))
      );
      return filtered;
    case "CLEAR":
      console.log("After CLEAR: []");
      return [];
    case "SET":
      console.log(
        "After SET:",
        action.payload.map((item) => ({ id: item.id, fileName: item.fileName }))
      );
      return action.payload;
    default:
      return state;
  }
}

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [uploadStatus, setUploadStatus] = useState<{
    [key: string]: "pending" | "uploading" | "success" | "error";
  }>({});
  const [chunkedFiles, setChunkedFiles] = useState<{
    [key: string]: boolean;
  }>({});
  const [downloadUrls, dispatchDownloadUrls] = useReducer(
    downloadUrlsReducer,
    []
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [showFileRestoreNotice, setShowFileRestoreNotice] = useState(false);
  const [linkValidationStatus, setLinkValidationStatus] = useState<{
    [key: string]: "valid" | "invalid" | "checking";
  }>({});
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);

    // Force HTTPS in production
    if (
      process.env.NODE_ENV === "production" &&
      window.location.protocol !== "https:"
    ) {
      window.location.replace(window.location.href.replace("http:", "https:"));
      return;
    }

    // Check crypto availability on mount
    if (!FileEncryption.isCryptoAvailable()) {
      console.warn(
        "Web Crypto API not available. Upload functionality will be limited."
      );
      if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        process.env.NODE_ENV === "production"
      ) {
        setCryptoError(
          "Secure file transfer requires HTTPS. Please access this site over HTTPS for full functionality."
        );
      } else if (window.location.protocol !== "https:") {
        console.warn(
          "Running in HTTP mode. For full security, use HTTPS in production."
        );
        setCryptoError(
          "Development mode: Running over HTTP. Web Crypto API may not be available. For production, use HTTPS."
        );
      }
    }

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Debug effect to monitor downloadUrls changes
  useEffect(() => {
    console.log(
      "downloadUrls state changed:",
      downloadUrls.map((item) => ({ id: item.id, fileName: item.fileName }))
    );
  }, [downloadUrls]);

  // Debug effect to monitor selectedFiles changes
  useEffect(() => {
    console.log(
      "selectedFiles state changed:",
      selectedFiles.map((f) => f.name)
    );
  }, [selectedFiles]);

  // Load persisted state on mount
  useEffect(() => {
    const loadAndValidatePersistedState = async () => {
      // Load download URLs from localStorage
      const savedDownloadUrls = localStorage.getItem(
        "fileTransfer_downloadUrls"
      );
      if (savedDownloadUrls) {
        try {
          const parsedUrls = JSON.parse(savedDownloadUrls);
          if (Array.isArray(parsedUrls) && parsedUrls.length > 0) {
            console.log("Found persisted download URLs:", parsedUrls.length);

            // Validate each URL with the backend
            const allUrls = [];
            const validationStatus: { [key: string]: "valid" | "invalid" } = {};

            for (const url of parsedUrls) {
              // Always add the URL to the list
              allUrls.push(url);

              try {
                // Check if the token still exists on the server
                const response = await fetch(`/api/file-info/${url.id}`);
                if (response.ok) {
                  validationStatus[url.id] = "valid";
                  console.log("Token still valid:", url.id);
                } else {
                  validationStatus[url.id] = "invalid";
                  console.log("Token expired or invalid:", url.id);
                }
              } catch (error) {
                validationStatus[url.id] = "invalid";
                console.log("Error validating token:", url.id, error);
              }
            }

            // Set validation status for all checked links
            setLinkValidationStatus(validationStatus);

            if (allUrls.length > 0) {
              dispatchDownloadUrls({ type: "SET", payload: allUrls });
              console.log(
                "Restored",
                allUrls.length,
                "download URLs (both valid and invalid)"
              );

              // Keep all URLs in localStorage (don't filter out invalid ones)
              localStorage.setItem(
                "fileTransfer_downloadUrls",
                JSON.stringify(allUrls)
              );
            } else {
              console.log("No download URLs found, clearing localStorage");
              localStorage.removeItem("fileTransfer_downloadUrls");
            }
          }
        } catch (error) {
          console.error(
            "Error loading download URLs from localStorage:",
            error
          );
          localStorage.removeItem("fileTransfer_downloadUrls");
        }
      }

      // Handle selected files notice
      const savedFileCount = localStorage.getItem(
        "fileTransfer_selectedFileCount"
      );
      if (savedFileCount && parseInt(savedFileCount) > 0) {
        console.log(
          "Note: Had",
          savedFileCount,
          "selected files before reload. Files need to be re-selected due to browser security."
        );
        setShowFileRestoreNotice(true);
        // Auto-hide the notice after 10 seconds
        setTimeout(() => setShowFileRestoreNotice(false), 10000);
      }
    };

    loadAndValidatePersistedState();
  }, []);

  // Persist download URLs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "fileTransfer_downloadUrls",
      JSON.stringify(downloadUrls)
    );
  }, [downloadUrls]);

  // Persist selected files count to localStorage (files themselves cannot be persisted)
  useEffect(() => {
    localStorage.setItem(
      "fileTransfer_selectedFileCount",
      selectedFiles.length.toString()
    );
  }, [selectedFiles]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) {
      console.log("=== FILE SELECTION === No files selected");
      return;
    }

    const fileArray = Array.from(files);
    console.log("=== FILE SELECTION ===");
    console.log(
      "Current selected files:",
      selectedFiles.map((f) => f.name)
    );
    console.log(
      "New files being selected:",
      fileArray.map((f) => f.name)
    );

    // Check for large files and show warnings
    fileArray.forEach((file) => {
      const sizeCheck = UploadDiagnostics.checkFileSize(file);
      const memoryCheck = UploadDiagnostics.checkMemoryEstimate(file.size);

      if (!sizeCheck.valid) {
        console.warn(
          `File size warning for ${file.name}: ${sizeCheck.message}`
        );
      }

      if (!memoryCheck.valid) {
        console.warn(`Memory warning for ${file.name}: ${memoryCheck.message}`);
      }

      if (file.size > 100 * 1024 * 1024) {
        // > 100MB - chunked upload threshold
        console.log(
          `Large file detected: ${
            file.name
          } (${UploadDiagnostics.formatFileSize(
            file.size
          )}) - will use chunked upload`
        );
      }

      if (file.size > 1024 * 1024 * 1024) {
        // > 1GB
        console.log(UploadDiagnostics.estimateUploadTime(file.size));
      }
    });

    // Replace selected files instead of appending
    setSelectedFiles(fileArray);
    console.log(
      "Files after selection:",
      fileArray.map((f) => f.name)
    );

    // Hide the restore notice since user has selected new files
    setShowFileRestoreNotice(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (index: number) => {
    console.log("=== REMOVE FILE ===");
    console.log("Removing file at index:", index);
    console.log(
      "Current selected files:",
      selectedFiles.map((f) => f.name)
    );
    console.log("File being removed:", selectedFiles[index]?.name);

    const fileToRemove = selectedFiles[index];
    const fileKey = `${fileToRemove.name}-${index}`;

    setSelectedFiles((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      console.log(
        "Files after removal:",
        filtered.map((f) => f.name)
      );
      return filtered;
    });

    // Clear related state
    setChunkedFiles((prev) => {
      const updated = { ...prev };
      delete updated[fileKey];
      return updated;
    });

    // Clear the file input to prevent caching issues
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      console.log("File input cleared");
    }
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    // Ensure we're running in a browser environment with crypto support
    if (!FileEncryption.isCryptoAvailable()) {
      const errorMsg =
        "Upload requires Web Crypto API support. Please ensure you are running in a secure context (HTTPS) and your browser supports the Web Crypto API.";
      console.error(errorMsg);
      setCryptoError(errorMsg);
      return;
    }

    setCryptoError(null);
    setIsUploading(true);

    // Initialize upload status for all files
    const initialStatus: {
      [key: string]: "pending" | "uploading" | "success" | "error";
    } = {};
    const initialProgress: { [key: string]: number } = {};

    selectedFiles.forEach((file, index) => {
      const fileKey = `${file.name}-${index}`;
      initialStatus[fileKey] = "pending";
      initialProgress[fileKey] = 0;
    });

    setUploadStatus(initialStatus);
    setUploadProgress(initialProgress);

    try {
      // Upload files one by one
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileKey = `${file.name}-${i}`;

        setUploadStatus((prev) => ({ ...prev, [fileKey]: "uploading" }));

        try {
          // Encrypt the file client-side
          setUploadProgress((prev) => ({ ...prev, [fileKey]: 10 }));
          console.log("Starting encryption for file:", file.name);

          let encryptionResult;
          try {
            encryptionResult = await FileEncryption.encryptFile(file);
            console.log("Encryption completed for file:", file.name);
          } catch (encryptError) {
            console.error("Encryption failed:", encryptError);
            throw new Error(
              `Encryption failed: ${
                encryptError instanceof Error
                  ? encryptError.message
                  : "Unknown error"
              }`
            );
          }

          setUploadProgress((prev) => ({ ...prev, [fileKey]: 20 }));

          // Determine upload method based on file size
          const encryptedSize = encryptionResult.encryptedData.byteLength;
          const CHUNK_THRESHOLD = 100 * 1024 * 1024; // 100MB threshold for chunked upload

          let result;

          if (encryptedSize > CHUNK_THRESHOLD) {
            console.log(
              `Large file detected (${UploadDiagnostics.formatFileSize(
                encryptedSize
              )}), using chunked upload`
            );

            // Mark as chunked file
            setChunkedFiles((prev) => ({ ...prev, [fileKey]: true }));

            // Use chunked upload for large files
            const metadataIv = btoa(
              String.fromCharCode(...encryptionResult.iv)
            );

            result = await ChunkedUpload.uploadFileInChunks(
              file,
              encryptionResult,
              metadataIv,
              (progress) => {
                // Map chunked upload progress (20-100%)
                const mappedProgress = Math.round(20 + progress * 0.8);
                setUploadProgress((prev) => ({
                  ...prev,
                  [fileKey]: mappedProgress,
                }));
              }
            );
          } else {
            console.log(
              `Standard file size (${UploadDiagnostics.formatFileSize(
                encryptedSize
              )}), using single request upload`
            );

            // Mark as non-chunked file
            setChunkedFiles((prev) => ({ ...prev, [fileKey]: false }));

            // Use standard upload for smaller files
            const encryptedBlob = new Blob([encryptionResult.encryptedData], {
              type: "application/octet-stream",
            });
            const encryptedFile = new File(
              [encryptedBlob],
              `encrypted-${file.name}`,
              { type: "application/octet-stream" }
            );

            const formData = new FormData();
            formData.append("encryptedFile", encryptedFile);
            formData.append("encryptionKey", encryptionResult.key);
            formData.append(
              "iv",
              btoa(String.fromCharCode(...encryptionResult.iv))
            );
            formData.append(
              "salt",
              btoa(String.fromCharCode(...encryptionResult.salt))
            );
            formData.append(
              "metadataIv",
              btoa(String.fromCharCode(...encryptionResult.iv))
            ); // Use same IV for now
            formData.append("originalName", file.name);
            formData.append("originalSize", file.size.toString());

            console.log("FormData prepared, sending to server...");
            setUploadProgress((prev) => ({ ...prev, [fileKey]: 90 }));

            const response = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(
                errorData.error || `Upload failed: ${response.statusText}`
              );
            }

            result = await response.json();
          }

          // Process successful result
          setUploadStatus((prev) => ({ ...prev, [fileKey]: "success" }));
          setUploadProgress((prev) => ({ ...prev, [fileKey]: 100 }));

          // Store the download URL
          if (result.downloadUrl && result.downloadToken) {
            const newItem = {
              id: result.downloadToken, // Use the actual token as ID for uniqueness
              fileName: result.originalName || file.name,
              downloadUrl: result.downloadUrl,
              expiresAt: result.expiresAt,
            };

            console.log("=== UPLOAD SUCCESS ===");
            console.log("New item to add:", newItem);
            console.log(
              "Current downloadUrls before adding:",
              downloadUrls.map((item) => ({
                id: item.id,
                fileName: item.fileName,
              }))
            );

            dispatchDownloadUrls({ type: "ADD", payload: newItem });

            // Validate the new link
            validateDownloadLink(newItem.id);
          }

          console.log("Upload successful:", result);
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);

          // Provide specific error messages based on error type
          let errorMessage = "Upload failed";
          if (error instanceof Error) {
            if (error.message.includes("File too large")) {
              errorMessage = "File too large (max 10GB)";
            } else if (error.message.includes("timeout")) {
              errorMessage = "Upload timeout - try again";
            } else if (
              error.message.includes("network") ||
              error.message.includes("fetch")
            ) {
              errorMessage = "Network error - check connection";
            } else if (error.message.includes("413")) {
              errorMessage = "File too large for server";
            } else if (error.message.includes("429")) {
              errorMessage = "Too many requests - wait and retry";
            } else if (error.message.includes("memory")) {
              errorMessage = "Server memory limit reached";
            }
          }

          console.error(`Upload error for ${file.name}: ${errorMessage}`);
          setUploadStatus((prev) => ({ ...prev, [fileKey]: "error" }));
          setUploadProgress((prev) => ({ ...prev, [fileKey]: 0 }));
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      console.log("URL copied to clipboard");
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy URL: ", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        setCopiedId(id);
        console.log("URL copied to clipboard (fallback)");
        setTimeout(() => setCopiedId(null), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed: ", fallbackErr);
        alert("Failed to copy URL to clipboard. Please copy manually.");
      }
      document.body.removeChild(textArea);
    }
  };

  const removeDownloadUrl = async (id: string) => {
    console.log("=== REMOVE OPERATION START ===");
    console.log("Attempting to remove download URL with token ID:", id);
    console.log(
      "Current downloadUrls before removal:",
      downloadUrls.map((item) => ({ id: item.id, fileName: item.fileName }))
    );

    const item = downloadUrls.find((item) => item.id === id);
    if (!item) {
      console.log("Item not found with ID:", id);
      console.log("=== REMOVE OPERATION END (NOT FOUND) ===");
      return;
    }

    console.log("Found item to remove:", {
      id: item.id,
      fileName: item.fileName,
    });

    // Add to deleting set for loading state
    setDeletingIds((prev) => {
      const newSet = new Set(prev).add(id);
      console.log("Added to deleting set:", id, "Set size:", newSet.size);
      return newSet;
    });

    // The ID is the token itself now
    const token = id;
    let deleteSuccess = false;
    let responseStatus = 0;

    try {
      console.log("Deleting file from server with token:", token);
      const response = await fetch(`/api/delete/${token}`, {
        method: "DELETE",
      });

      responseStatus = response.status;
      console.log("Delete response status:", response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log("File deleted from server successfully:", responseData);
        deleteSuccess = true;
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        const errorMessage = errorData.error || response.statusText;

        // If the token is not found, treat it as already deleted
        if (
          errorMessage.includes("Token not found") ||
          errorMessage.includes("not found") ||
          response.status === 404
        ) {
          console.log("Token not found on server, treating as already deleted");
          deleteSuccess = true; // Allow removal from UI
        } else {
          // Only log as error if it's not an expected "not found" case
          console.error("Failed to delete file from server:", errorMessage);
        }
      }
    } catch (error) {
      console.error("Error deleting file from server:", error);
    }

    // Only remove from UI if delete was successful or if we couldn't find the token (already deleted)
    // Also remove if the link is marked as invalid or if we get a 404 (token not found)
    const isInvalidLink = linkValidationStatus[id] === "invalid";
    const shouldRemove =
      deleteSuccess || isInvalidLink || responseStatus === 404;

    if (shouldRemove) {
      console.log(
        "Removing from UI state... Reason:",
        deleteSuccess
          ? "Delete successful"
          : isInvalidLink
          ? "Link marked as invalid"
          : "Token not found (404)"
      );
      dispatchDownloadUrls({ type: "REMOVE", payload: id });
    } else {
      console.warn("File deletion failed, keeping in UI for retry");
    }

    setDeletingIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      console.log("Removed from deleting set:", id, "Set size:", newSet.size);
      return newSet;
    });

    console.log("=== REMOVE OPERATION END ===");
    console.log(
      "Removal operation completed for ID:",
      id,
      "Success:",
      deleteSuccess
    );
  };

  const clearAllDownloadUrls = async () => {
    console.log("=== CLEAR ALL OPERATION START ===");
    console.log(
      "Starting clear all operation for",
      downloadUrls.length,
      "files"
    );
    console.log(
      "Current downloadUrls:",
      downloadUrls.map((item) => ({ id: item.id, fileName: item.fileName }))
    );

    setIsClearing(true);

    // Delete all files from server using token IDs
    const deleteResults = await Promise.allSettled(
      downloadUrls.map(async (item) => {
        const token = item.id; // ID is the token now
        try {
          console.log(`Deleting file with token: ${token}`);
          const response = await fetch(`/api/delete/${token}`, {
            method: "DELETE",
          });

          console.log(`Delete response for ${token}:`, response.status);

          if (response.ok) {
            const responseData = await response.json();
            console.log(
              `Successfully deleted file with token ${token}:`,
              responseData
            );
            return { success: true, token };
          } else {
            const errorData = await response
              .json()
              .catch(() => ({ error: "Unknown error" }));
            const errorMessage = errorData.error || response.statusText;

            // If the token is not found, treat it as already deleted
            if (
              errorMessage.includes("Token not found") ||
              errorMessage.includes("not found") ||
              response.status === 404
            ) {
              console.log(
                `Token ${token} not found on server, treating as already deleted`
              );
              return { success: true, token };
            } else {
              console.error(
                `Failed to delete file with token ${token}:`,
                errorMessage
              );
              return {
                success: false,
                token,
                error: errorMessage,
              };
            }
          }
        } catch (error) {
          console.error(`Error deleting file with token ${token}:`, error);
          return {
            success: false,
            token,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    // Log results
    const successful = deleteResults.filter(
      (result) => result.status === "fulfilled" && result.value.success
    ).length;
    const failed = deleteResults.length - successful;
    console.log(
      `Clear all completed: ${successful} successful, ${failed} failed`
    );
    console.log("Delete results:", deleteResults);

    // Only clear UI if all deletions were successful
    if (failed === 0) {
      console.log("All deletions successful, clearing UI");
      dispatchDownloadUrls({ type: "CLEAR" });
      // Clear persisted data
      localStorage.removeItem("fileTransfer_downloadUrls");
      console.log("Cleared localStorage");
    } else {
      console.warn("Some deletions failed, keeping failed items in UI");
      // Remove only the successfully deleted items (don't auto-remove invalid links)
      const successfulTokens = deleteResults
        .filter(
          (result) => result.status === "fulfilled" && result.value.success
        )
        .map((result) => (result as PromiseFulfilledResult<any>).value.token);

      console.log("Successfully deleted tokens:", successfulTokens);

      // Remove successful tokens one by one
      successfulTokens.forEach((token) => {
        console.log("Removing successful token from UI:", token);
        dispatchDownloadUrls({ type: "REMOVE", payload: token });
      });
    }

    setIsClearing(false);
    console.log("=== CLEAR ALL OPERATION END ===");
  };

  // Clear all persisted data
  const clearPersistedData = () => {
    localStorage.removeItem("fileTransfer_downloadUrls");
    localStorage.removeItem("fileTransfer_selectedFileCount");
    console.log("Cleared all persisted data");
  };

  // Validate a single download link
  const validateDownloadLink = async (id: string) => {
    setLinkValidationStatus((prev) => ({ ...prev, [id]: "checking" }));

    try {
      const response = await fetch(`/api/file-info/${id}`);
      if (response.ok) {
        setLinkValidationStatus((prev) => ({ ...prev, [id]: "valid" }));
        return true;
      } else {
        setLinkValidationStatus((prev) => ({ ...prev, [id]: "invalid" }));
        return false;
      }
    } catch (error) {
      console.error("Error validating link:", id, error);
      setLinkValidationStatus((prev) => ({ ...prev, [id]: "invalid" }));
      return false;
    }
  };

  // Validate all download links
  const validateAllDownloadLinks = async () => {
    console.log("Validating all download links...");
    for (const url of downloadUrls) {
      await validateDownloadLink(url.id);
    }
  };

  // Debug function to check backend status
  const debugBackendStatus = async () => {
    try {
      console.log("=== DEBUG: Checking backend status ===");
      const response = await fetch("/api/status");
      if (response.ok) {
        const data = await response.json();
        console.log("Backend response:", data);
        console.log("Valid tokens in backend:", data.validTokens?.length || 0);
        console.log("Current frontend URLs:", downloadUrls.length);

        if (data.validTokens) {
          console.log(
            "Backend tokens:",
            data.validTokens.map((t: any) => ({
              id: t.id,
              fileName: t.fileName,
            }))
          );
        }
      } else {
        console.error("Failed to fetch backend status:", response.statusText);
      }
    } catch (error) {
      console.error("Error checking backend status:", error);
    }
  };

  // Debug function to force clear everything
  const debugForceReset = async () => {
    try {
      console.log("=== FORCE RESET: Clearing everything ===");

      // First clear frontend
      dispatchDownloadUrls({ type: "CLEAR" });
      console.log("Frontend cleared");

      // Clear persisted data
      clearPersistedData();

      // Then get all backend tokens and delete them
      const response = await fetch("/api/status");
      if (response.ok) {
        const data = await response.json();
        if (data.validTokens && data.validTokens.length > 0) {
          console.log(
            "Found",
            data.validTokens.length,
            "backend tokens to delete"
          );

          for (const token of data.validTokens) {
            try {
              const deleteResponse = await fetch(`/api/delete/${token.id}`, {
                method: "DELETE",
              });
              if (deleteResponse.ok) {
                console.log("Deleted backend token:", token.id);
              } else {
                console.error("Failed to delete backend token:", token.id);
              }
            } catch (error) {
              console.error("Error deleting backend token:", token.id, error);
            }
          }
        }
      }

      console.log("=== FORCE RESET COMPLETE ===");

      // Check status again
      await debugBackendStatus();
    } catch (error) {
      console.error("Error in force reset:", error);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Matrix-style Background Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            transform: isMounted
              ? `translateY(${scrollY * 0.5}px)`
              : "translateY(0px)",
          }}
        >
          <div className="absolute top-20 left-10 w-32 h-32 bg-green-500/20 blur-2xl"></div>
          <div className="absolute top-40 right-20 w-48 h-48 bg-green-400/10 blur-3xl"></div>
          <div className="absolute bottom-40 left-1/4 w-40 h-40 bg-green-600/15 blur-2xl"></div>
        </div>

        {/* Terminal Grid Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            transform: isMounted
              ? `translateY(${scrollY * 0.3}px)`
              : "translateY(0px)",
            backgroundImage: `
              linear-gradient(rgba(0,255,0,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,255,0,0.3) 1px, transparent 1px)
            `,
            backgroundSize: "30px 30px",
          }}
        ></div>

        <div className="max-w-6xl mx-auto px-4 py-12 relative z-10">
          {/* Hero Section with Parallax */}
          <div
            className="text-center mb-16"
            style={{
              fontFamily: "Roboto, sans-serif",
              transform: isMounted
                ? `translateY(${scrollY * 0.1}px)`
                : "translateY(0px)",
            }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight tracking-wider terminal-cursor">
              {">"} SECURE FILE
              <span className="text-green-400"> TRANSFER_</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Experience lightning-fast, secure file transfers with
              enterprise-grade encryption and real-time monitoring capabilities.
            </p>
          </div>

          {/* Crypto Error Notice */}
          {cryptoError && (
            <div className="max-w-4xl mx-auto mb-6">
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 flex items-center gap-3">
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
                  <strong>Crypto Error:</strong> {cryptoError}
                </div>
                <button
                  onClick={() => setCryptoError(null)}
                  className="ml-auto text-red-400 hover:text-red-300 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* File Restore Notice */}
          {showFileRestoreNotice && (
            <div className="max-w-4xl mx-auto mb-6">
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-yellow-500 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div
                  className="text-yellow-200 text-sm"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  <strong>Notice:</strong> You had files selected before the
                  page reload. Due to browser security, please re-select your
                  files to continue.
                </div>
                <button
                  onClick={() => setShowFileRestoreNotice(false)}
                  className="ml-auto text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div
            className="max-w-4xl mx-auto mb-20"
            style={{
              transform: isMounted
                ? `translateY(${scrollY * 0.05}px)`
                : "translateY(0px)",
              position: "relative",
              zIndex: 20,
            }}
          >
            <div
              className={`relative bg-black border-2 p-8 transition-all duration-300 ${
                isDragOver
                  ? "border-green-400 bg-green-900/10 shadow-2xl shadow-green-500/20"
                  : "border-green-500 hover:border-green-400 hover:bg-green-900/5"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div
                className="text-center"
                style={{ fontFamily: "Roboto, sans-serif" }}
              >
                <div
                  className="mx-auto h-20 w-20 bg-black border-2 border-green-500 flex items-center justify-center mb-6"
                  style={{
                    transform: `translateY(${Math.sin(scrollY * 0.01) * 5}px)`,
                    transition: "transform 0.1s ease-out",
                  }}
                >
                  <svg
                    className="h-10 w-10 text-green-500"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h3 className="text-2xl font-semibold text-white mb-3 tracking-wide">
                  [DRAG FILES HERE]
                </h3>
                <p className="text-gray-300 mb-8 text-sm">
                  ALL FILE TYPES • MAX: 10GB • ENCRYPTION: AES-256
                  <br />
                  STATUS: READY FOR SECURE TRANSMISSION
                </p>

                <NoSSR fallback={<div className="sr-only"></div>}>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    onChange={handleInputChange}
                  />
                </NoSSR>

                <button
                  type="button"
                  onClick={handleButtonClick}
                  className="matrix-button inline-flex items-center px-8 py-4 text-lg font-bold text-white bg-black border-2 border-white hover:bg-white hover:text-black focus:outline-none focus:ring-4 focus:ring-white/50 transition-all duration-200 shadow-lg hover:shadow-white/50 cursor-pointer tracking-wider"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
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
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  SELECT FILES
                </button>
              </div>
            </div>
          </div>

          {/* Selected Files Display */}
          {selectedFiles.length > 0 && (
            <div
              className="max-w-4xl mx-auto mt-8 mb-12"
              style={{
                fontFamily: "Roboto, sans-serif",
                transform: isMounted
                  ? `translateY(${scrollY * 0.03}px)`
                  : "translateY(0px)",
                position: "relative",
                zIndex: 15,
              }}
            >
              <div className="bg-black border-2 border-green-400/30 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-white">
                    SELECTED FILES ({selectedFiles.length})
                  </h3>
                  <div className="text-sm text-gray-400">
                    TOTAL:{" "}
                    {formatFileSize(
                      selectedFiles.reduce((acc, file) => acc + file.size, 0)
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedFiles.map((file, index) => {
                    const fileKey = `${file.name}-${index}`;
                    const status = uploadStatus[fileKey] || "pending";
                    const progress = uploadProgress[fileKey] || 0;

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-black border border-gray-500 hover:border-gray-300 transition-colors duration-200"
                      >
                        <div className="flex items-center flex-1">
                          <div
                            className={`flex-shrink-0 w-12 h-12 border-2 flex items-center justify-center ${
                              status === "success"
                                ? "bg-green-500 border-green-400"
                                : status === "error"
                                ? "bg-red-500 border-red-400"
                                : status === "uploading"
                                ? "bg-yellow-500 border-yellow-400"
                                : "bg-black border-white"
                            }`}
                          >
                            {status === "success" ? (
                              <svg
                                className="w-6 h-6 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : status === "error" ? (
                              <svg
                                className="w-6 h-6 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : status === "uploading" ? (
                              <svg
                                className="animate-spin w-6 h-6 text-white"
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
                            ) : (
                              <svg
                                className="w-6 h-6 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="ml-4 flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p
                                className="text-sm font-medium text-white break-words overflow-wrap-anywhere mr-2"
                                style={{
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                }}
                                title={file.name}
                              >
                                {file.name}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-400">
                                {formatFileSize(file.size)}
                                {chunkedFiles[fileKey] && (
                                  <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 border border-blue-500">
                                    CHUNKED UPLOAD
                                  </span>
                                )}
                              </p>
                              {status === "uploading" && (
                                <div className="w-32 bg-gray-700 border border-gray-500 h-2 ml-4">
                                  <div
                                    className="bg-green-400 h-2 transition-all duration-300"
                                    style={{
                                      width: `${Math.round(progress)}%`,
                                    }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 border ml-4 ${
                            status === "success"
                              ? "bg-green-500/20 text-green-400 border-green-500"
                              : status === "error"
                              ? "bg-red-500/20 text-red-400 border-red-500"
                              : status === "uploading"
                              ? "bg-yellow-500/20 text-yellow-400 border-yellow-500"
                              : "bg-gray-500/20 text-gray-400 border-gray-500"
                          }`}
                        >
                          {status === "success"
                            ? "Uploaded"
                            : status === "error"
                            ? "Failed"
                            : status === "uploading"
                            ? `${Math.round(progress)}%`
                            : "Pending"}
                        </span>
                        {status !== "uploading" && (
                          <button
                            onClick={() => removeFile(index)}
                            className="flex items-center justify-center w-10 h-10 bg-black border border-red-500 hover:bg-red-500 hover:text-black text-red-400 transition-colors duration-200 cursor-pointer ml-4"
                            title="Remove from list"
                          >
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={uploadFiles}
                    disabled={
                      isUploading ||
                      selectedFiles.length === 0 ||
                      !FileEncryption.isCryptoAvailable()
                    }
                    className={`cursor-pointer flex-1 matrix-button ${
                      isUploading || !FileEncryption.isCryptoAvailable()
                        ? "bg-gray-600 border-gray-500 cursor-not-allowed text-gray-400"
                        : "bg-black border-white text-white hover:bg-white hover:text-black"
                    } font-medium py-3 px-6 border-2 transition-all duration-200`}
                    style={{ fontFamily: "Roboto, sans-serif" }}
                  >
                    <div className="flex items-center justify-center">
                      {isUploading ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
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
                          UPLOADING...
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
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4"
                            />
                          </svg>
                          UPLOAD FILES
                        </>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      console.log("=== CLEAR ALL FILES ===");
                      setSelectedFiles([]);
                      setChunkedFiles({});
                      // Clear the file input to prevent caching issues
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                        console.log("File input cleared");
                      }
                    }}
                    className="cursor-pointer matrix-button px-6 py-3 border-2 border-gray-500 text-gray-400 hover:text-white hover:border-white transition-all duration-200"
                    style={{ fontFamily: "Roboto, sans-serif" }}
                  >
                    CLEAR ALL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Download URLs Section */}
          {downloadUrls.length > 0 && (
            <div
              className="max-w-4xl mx-auto mb-16 px-6 mt-8"
              style={{
                transform: isMounted
                  ? `translateY(${scrollY * 0.02}px)`
                  : "translateY(0px)",
                position: "relative",
                zIndex: 10,
              }}
            >
              <div className="bg-black border-2 border-green-400/20 p-8">
                <h2
                  className="text-2xl font-bold text-white mb-6 text-center"
                  style={{ fontFamily: "Roboto, sans-serif" }}
                >
                  DOWNLOAD LINKS
                </h2>
                <div className="space-y-4">
                  {downloadUrls.map((item) => (
                    <div
                      key={`download-${item.id}-${item.downloadUrl}`}
                      className="bg-black border border-gray-500 p-4 hover:border-gray-300 transition-colors duration-300"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-white font-medium break-words overflow-wrap-anywhere"
                            style={{
                              fontFamily: "Roboto, sans-serif",
                              wordBreak: "break-word",
                              overflowWrap: "anywhere",
                            }}
                            title={item.fileName}
                          >
                            {item.fileName}
                          </p>
                          <p className="text-gray-400 text-sm mt-1">
                            Expires: {new Date(item.expiresAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Status indicator */}
                          <div className="flex items-center">
                            {linkValidationStatus[item.id] === "checking" ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300 border border-yellow-600/30">
                                <svg
                                  className="animate-spin w-3 h-3 mr-1"
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
                                Checking...
                              </span>
                            ) : linkValidationStatus[item.id] === "valid" ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-300 border border-green-600/30">
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
                            ) : linkValidationStatus[item.id] === "invalid" ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300 border border-red-600/30">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Invalid
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-900/30 text-gray-400 border border-gray-600/30">
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Unknown
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              copyToClipboard(item.downloadUrl, item.id)
                            }
                            className={`matrix-button flex items-center gap-2 px-4 py-2 ${
                              copiedId === item.id
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-black border-2 border-white hover:bg-white hover:text-black text-white"
                            } transition-all duration-200 text-sm cursor-pointer`}
                            style={{ fontFamily: "Roboto, sans-serif" }}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              {copiedId === item.id ? (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              ) : (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              )}
                            </svg>
                            {copiedId === item.id ? "COPIED!" : "COPY LINK"}
                          </button>
                          <button
                            onClick={() => removeDownloadUrl(item.id)}
                            disabled={deletingIds.has(item.id)}
                            className="flex items-center justify-center w-10 h-10 bg-black border border-red-500 hover:bg-red-500 hover:text-black text-red-400 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove from list"
                          >
                            {deletingIds.has(item.id) ? (
                              <svg
                                className="animate-spin w-4 h-4"
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
                            ) : (
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
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-white">
                  <p
                    className="text-gray-400 text-sm text-center"
                    style={{ fontFamily: "Roboto, sans-serif" }}
                  >
                    Download links valid for 24 hours • Share securely
                  </p>
                  <div className="flex gap-3 justify-center mt-3">
                    <button
                      onClick={validateAllDownloadLinks}
                      className="cursor-pointer matrix-button flex items-center gap-2 px-4 py-2 bg-black border-2 border-white text-white hover:bg-white hover:text-black transition-all duration-300 text-sm"
                      style={{ fontFamily: "Roboto, sans-serif" }}
                    >
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      REFRESH STATUS
                    </button>
                    <button
                      onClick={clearAllDownloadUrls}
                      disabled={isClearing}
                      className="cursor-pointer matrix-button flex items-center gap-2 px-4 py-2 bg-black border-2 border-white text-white hover:bg-white hover:text-black transition-all duration-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white"
                      style={{ fontFamily: "Roboto, sans-serif" }}
                    >
                      {isClearing && (
                        <svg
                          className="animate-spin w-4 h-4"
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
                      )}
                      {isClearing ? "CLEARING..." : "CLEAR ALL LINKS"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section Separator */}
          <div className="mt-24 mb-16 flex items-center justify-center">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-500/50 to-transparent"></div>
            <div className="mx-8 flex items-center space-x-2">
              <div className="w-2 h-2 bg-white/60"></div>
              <div className="w-2 h-2 bg-gray-400/60"></div>
              <div className="w-2 h-2 bg-green-400/60"></div>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-500/50 to-transparent"></div>
          </div>

          {/* Features Section */}
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            style={{
              fontFamily: "Roboto, sans-serif",
              transform: isMounted
                ? `translateY(${scrollY * 0.02}px)`
                : "translateY(0px)",
            }}
          >
            <div className="text-center p-6 bg-black border border-green-400">
              <div
                className="w-12 h-12 bg-white/20 border border-green-200 flex items-center justify-center mx-auto mb-4"
                style={{
                  transform: isMounted
                    ? `translateY(${Math.sin(scrollY * 0.005) * 5}px)`
                    : "translateY(0px)",
                }}
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                SECURE TRANSFER
              </h3>
              <p className="text-gray-400 text-sm">
                End-to-end encryption ensures your files are protected during
                transfer
              </p>
            </div>

            <div className="text-center p-6 bg-black border border-green-400">
              <div
                className="w-12 h-12 bg-white/20 border border-green-200 flex items-center justify-center mx-auto mb-4"
                style={{
                  transform: isMounted
                    ? `translateY(${Math.sin(scrollY * 0.007) * 5}px)`
                    : "translateY(0px)",
                }}
              >
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                LIGHTNING FAST
              </h3>
              <p className="text-gray-400 text-sm">
                Optimized transfer speeds with no file compression, quality is
                preserved
              </p>
            </div>

            <div className="text-center p-6 bg-black border border-green-400">
              <div
                className="w-12 h-12 bg-white/20 border border-green-200 flex items-center justify-center mx-auto mb-4"
                style={{
                  transform: isMounted
                    ? `translateY(${Math.sin(scrollY * 0.009) * 5}px)`
                    : "translateY(0px)",
                }}
              >
                <svg
                  className="w-6 h-6 text-white"
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
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                RELIABLE
              </h3>
              <p className="text-gray-400 text-sm">
                99.9% Uptime with CDN support for global reach
              </p>
            </div>
          </div>
        </div>
        <hr className="mt-16 border-t border-green-400/50"></hr>
      </div>

      {/* API Usage Section */}
      <div className="py-16 bg-black">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              COMMAND LINE ACCESS
            </h2>
            <p className="text-gray-400 text-lg">
              Download files programmatically using WGET or CURL
            </p>
          </div>

          <div className="bg-black border-2 border-white p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* wget Instructions */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 9l3 3-3 3m5 0h3"
                    />
                  </svg>
                  USING WGET
                </h3>
                <div className="bg-gray-900 border border-green-300/80 p-4 mb-4">
                  <code className="text-green-400 text-sm block break-all">
                    wget --content-disposition
                    "https://metalfiles.tech/api/download/[token]"
                  </code>
                </div>
                <p className="text-gray-400 text-sm">
                  Replace <span className="text-white">[TOKEN]</span> with your
                  download token <br />
                  The <span className="text-white">
                    --CONTENT-DISPOSITION
                  </span>{" "}
                  flag ensures the original file name is preserved.
                </p>
              </div>

              {/* curl Instructions */}
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 9l3 3-3 3m5 0h3"
                    />
                  </svg>
                  USING CURL
                </h3>
                <div className="bg-gray-900 border border-green-300/80 p-4 mb-4">
                  <code className="text-green-400 text-sm block break-all">
                    curl -OJ "https://metalfiles.tech/api/download/[token]"
                  </code>
                </div>
                <p className="text-gray-400 text-sm">
                  The <span className="text-white">-OJ</span> flag save the file
                  with its original name and follow redirects.
                </p>
              </div>
            </div>

            {/* Important Notes */}
            <div className="mt-8 p-6 bg-red-900/20 border border-red-500">
              <h4 className="text-red-400 font-semibold mb-2 flex items-center font-mono">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                IMPORTANT NOTES
              </h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>
                  • Download links are{" "}
                  <span className="text-red-400">ONE-TIME USE ONLY</span> - they
                  become invalid after the first download.
                </li>
                <li>• Files are automatically decrypted during download</li>
                <li>• Links expire after 24 hours if not used</li>
                <li>• Maximum file size: 10GB</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
