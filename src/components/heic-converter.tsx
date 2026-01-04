"use client";

import React, { useState, useRef } from "react";
import JSZip from "jszip";

export default function HeicConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [convertedFiles, setConvertedFiles] = useState<{ original: File; converted: Blob }[]>([]);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidHeicFile = (file: File): boolean => {
    const validExtensions = [".heic", ".heif", ".jpg", ".jpeg"];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));
    const hasValidMimeType = file.type === "" || file.type.startsWith("image/");
    return hasValidExtension && hasValidMimeType && file.size <= 50 * 1024 * 1024;
  };

  const convertHeicToPng = async (file: File): Promise<Blob> => {
    if (file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg")) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);

            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Canvas conversion failed"));
            }, "image/png");
          };
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    try {
      const heic2any = (await import("heic2any")).default;
      const result = await heic2any({
        blob: file,
        toType: "image/png",
        quality: 1,
      });
      return Array.isArray(result) ? result[0] : result;
    } catch (err) {
      throw new Error(`Failed to convert ${file.name}: ${err}`);
    }
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    setError("");
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileArray = Array.from(selectedFiles);
    if (fileArray.length > 100) {
      setError("Maximum 100 files allowed.");
      return;
    }

    const validFiles = fileArray.filter(isValidHeicFile);
    if (validFiles.length === 0) {
      setError("No valid HEIC/HEIF/JPG files selected.");
      return;
    }

    setFiles(validFiles);
    setConvertedFiles([]);
  };

  const handleConvert = async () => {
    if (files.length === 0) return;

    setConverting(true);
    setError("");
    setProgress({ current: 0, total: files.length });

    try {
      const results: { original: File; converted: Blob }[] = [];

      for (let i = 0; i < files.length; i++) {
        try {
          const pngBlob = await convertHeicToPng(files[i]);
          results.push({ original: files[i], converted: pngBlob });
          setProgress({ current: i + 1, total: files.length });
        } catch (err) {
          console.error(`Failed to convert ${files[i].name}:`, err);
        }
      }

      setConvertedFiles(results);

      // Auto-download after conversion
      if (results.length > 0) {
        if (results.length === 1) {
          const { saveAs } = await import("file-saver");
          const fileName = results[0].original.name.replace(/\.(heic|heif|jpg|jpeg)$/i, ".png");
          saveAs(results[0].converted, fileName);
        } else {
          const zip = new JSZip();
          results.forEach(({ original, converted }) => {
            const fileName = original.name.replace(/\.(heic|heif|jpg|jpeg)$/i, ".png");
            zip.file(fileName, converted);
          });
          const zipBlob = await zip.generateAsync({ type: "blob" });
          const { saveAs } = await import("file-saver");
          saveAs(zipBlob, `heic-to-png-${Date.now()}.zip`);
        }
      }

      if (results.length === 0) {
        setError("All files failed to convert.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setConvertedFiles([]);
    setProgress({ current: 0, total: 0 });
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6">Convert HEIC Photos Instantly</h2>

        {!converting && convertedFiles.length === 0 && (
          <div>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer transition-all hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileSelect(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".heic,.heif,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Drag & drop HEIC files or click to upload
              </p>
              <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                Select Files
              </button>
            </div>

            {files.length > 0 && (
              <div className="mt-6">
                <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                  {files.length} file{files.length > 1 ? "s" : ""} selected
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleConvert}
                    disabled={converting}
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {converting ? "Converting..." : "Convert to PNG"}
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 border border-gray-300 text-gray-800 dark:text-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                      {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {converting && (
          <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-center">Converting Your Files</h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mb-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {progress.current} of {progress.total} completed
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
              This conversion happens locally in your browser. Please keep this tab open.
            </p>
          </div>
        )}

        {convertedFiles.length > 0 && !converting && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
            <div className="flex flex-col items-center justify-center text-center">
              <svg className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-2xl font-bold mt-4">Conversion Complete!</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {convertedFiles.length} file{convertedFiles.length > 1 ? "s" : ""} successfully converted to PNG.
                Download{convertedFiles.length > 1 ? "s" : ""} started automatically.
              </p>
              <button
                onClick={handleReset}
                className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Convert More Files
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
