"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
// import { useDropzone } from "react-dropzone"; // Assuming react-dropzone might be needed, or I'll implement simple drag-drop
// Note: react-dropzone is NOT in the package.json provided earlier. I will implement native drag & drop.
import {
  Settings2,
  Image as ImageIcon,
  FileImage,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  FileArchive,
  ChevronRight,
  Check,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

// Types
type ConversionStatus = "idle" | "adding" | "preparing" | "converting" | "completed" | "cancelled" | "error";
type OutputFormat = "PNG" | "JPG" | "WebP";

interface HeicFile {
  id: string;
  file: File;
  status: "pending" | "converting" | "success" | "error";
  progress: number;
  resultBlob?: Blob;
  errorMsg?: string;
}

export default function HeicConverterV2() {
  // State
  const [files, setFiles] = useState<HeicFile[]>([]);
  const [status, setStatus] = useState<ConversionStatus>("idle");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("PNG");
  
  // Advanced Settings
  const [keepResolution, setKeepResolution] = useState(true);
  const [preserveExif, setPreserveExif] = useState(false);
  const [quality, setQuality] = useState(90); // 1-100
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Refs for auto-scroll
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const progressSectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    const smoothScroll = (element: HTMLElement | null, offset: number) => {
      if (!element) return;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    };

    if (status === "converting") {
      // Scroll to progress section with breathing room (96px)
      // Delay slightly to ensure layout rendering
      setTimeout(() => {
        smoothScroll(progressSectionRef.current, 96);
      }, 100);
    } else if (status === "idle") {
      // Scroll back to upload section
      // Only trigger if we are actively resetting (implicit by status change to idle)
      setTimeout(() => {
        smoothScroll(uploadSectionRef.current, 96);
      }, 100);
    }
  }, [status]);

  // Constants
  const ACCEPTED_TYPES = [".heic", ".heif"];

  // Handlers
  const handleFilesAdded = useCallback((newFiles: File[]) => {
    // Filter for HEIC/HEIF and Valid types
    const validFiles = newFiles.filter(f => 
      f.name.toLowerCase().endsWith('.heic') || 
      f.name.toLowerCase().endsWith('.heif')
    );
    
    if (validFiles.length === 0) return;

    setStatus("adding");
    
    const newHeicFiles: HeicFile[] = validFiles.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      file: f,
      status: "pending",
      progress: 0
    }));

    setFiles(prev => [...prev, ...newHeicFiles]);
    setStatus("preparing");
    // Auto start conversion
    // In a real app, use useEffect to trigger conversion queue
  }, []);

  // Refs for state tracking
  const processingRef = useRef(false);

  // Effect to manage conversion queue
  useEffect(() => {
    // Only trigger if we have pending files and aren't already processing
    const hasPending = files.some(f => f.status === "pending");
    
    if (hasPending && !processingRef.current) {
      if (status === "preparing" || status === "converting") {
         processQueue();
      }
    }
  }, [files, status]);

  const processQueue = async () => {
    // Double check lock
    if (processingRef.current) return;
    
    const pendingFiles = files.filter(f => f.status === "pending");
    if (pendingFiles.length === 0) return;

    // Lock processing
    processingRef.current = true;
    if (status !== "converting") setStatus("converting");

    // 2. Determine concurrency limit (default to 4, max 6, min 1)
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
    const MAX_CONCURRENT = Math.max(1, Math.min(cores || 4, 6));

    console.log(`Starting conversion batch of ${pendingFiles.length} files with concurrency: ${MAX_CONCURRENT}`);

    // Track active promises to prevent overwhelming the main thread
    let activeWorkers = 0;
    let index = 0;

    // Helper to process a single file and then trigger the next
    const processNext = async () => {
      if (index >= pendingFiles.length) {
        // No more new tasks to spawn from this batch
        return; 
      }

      const fileItem = pendingFiles[index];
      index++; // Move to next
      activeWorkers++;

      // Update status to converting
      updateFileStatus(fileItem.id, { status: "converting", progress: 0 });

      try {
        // Yield to UI thread before heavy lifting to prevent freeze
        await new Promise(resolve => setTimeout(resolve, 50));

        const convertedBlob = await convertHeicToPng(fileItem.file);
        
        updateFileStatus(fileItem.id, { 
          status: "success", 
          progress: 100,
          resultBlob: convertedBlob
        });
      } catch (error) {
        console.error("Conversion error:", error);
        updateFileStatus(fileItem.id, { 
          status: "error", 
          errorMsg: "Conversion failed" 
        });
      } finally {
        activeWorkers--;
        
        // Trigger next file if available
        if (index < pendingFiles.length) {
           processNext();
        } else if (activeWorkers === 0) {
           // Batch complete
           processingRef.current = false;
           checkCompletion();
        }
      }
    };

    // 3. Start initial batch
    const initialBatch = Math.min(MAX_CONCURRENT, pendingFiles.length);
    for (let i = 0; i < initialBatch; i++) {
        processNext();
    }
  };
  
  // Helper to check efficiently if strictly ALL files are done (avoiding heavy restarts)
  const checkCompletion = () => {
    setFiles(currentFiles => {
      const isProcessing = currentFiles.some(f => f.status === "converting" || f.status === "pending");
      if (!isProcessing) {
        // Slight delay to ensure UI updates finish
        setTimeout(() => setStatus("completed"), 100);
      }
      return currentFiles;
    });
  };

  const convertHeicToPng = async (file: File): Promise<Blob> => {
    // Basic format handling for non-HEIC files
    if (file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg") || file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
       return file; 
    }

    try {
      // Dynamic import to avoid SSR issues
      const heic2any = (await import("heic2any")).default;
      
      // Determine quality parameter (0 to 1)
      const targetFormatType = outputFormat === 'JPG' ? 'image/jpeg' : (outputFormat === 'WebP' ? 'image/webp' : 'image/png');
      const conversionQuality = quality / 100;

      const result = await heic2any({
        blob: file,
        toType: targetFormatType,
        quality: conversionQuality,
      });

      const blob = Array.isArray(result) ? result[0] : result;
      return blob;
    } catch (err) {
      console.error("Heic2any main thread error:", err);
      throw new Error(`Failed to convert ${file.name}`);
    }
  };

  const updateFileStatus = (id: string, updates: Partial<HeicFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };
  
  const handleCancel = () => {
    // Stop processing flag
    processingRef.current = false;
    // Set status to cancelled to show specific UI
    setStatus("cancelled");
    setFiles([]); // Clear files as requested implies no continued processing or result showing
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(Array.from(e.target.files));
    }
  };

  const handleDownloadAll = async () => {
    const successFiles = files.filter(f => f.status === "success" && f.resultBlob);
    if (successFiles.length === 0) return;

    // Single file download (delegated)
    if (successFiles.length === 1) {
       handleDownloadOne(successFiles[0]);
       return;
    }

    // ZIP download
    const zip = new JSZip();
    const usedNames = new Set<string>();
    
    successFiles.forEach(f => {
      const originalName = f.file.name.replace(/\.(heic|heif|jpg|jpeg)$/i, "");
      const ext = outputFormat === 'JPG' ? 'jpg' : (outputFormat === 'WebP' ? 'webp' : 'png');
      
      let fileName = `${originalName}.${ext}`;
      let counter = 1;
      
      // Handle collisions
      while (usedNames.has(fileName)) {
        fileName = `${originalName} (${counter}).${ext}`;
        counter++;
      }
      usedNames.add(fileName);

      if (f.resultBlob) {
        zip.file(fileName, f.resultBlob);
      }
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "heic-to-png.zip");
    } catch (error) {
      console.error("Failed to generate zip", error);
      alert("Failed to generate ZIP file.");
    }
  };

  const handleDownloadOne = (fileItem: HeicFile) => {
    if (!fileItem.resultBlob) return;
    const originalName = fileItem.file.name.replace(/\.(heic|heif|jpg|jpeg)$/i, "");
    const ext = outputFormat === 'JPG' ? 'jpg' : (outputFormat === 'WebP' ? 'webp' : 'png');
    saveAs(fileItem.resultBlob, `${originalName}.${ext}`);
  };

  const handleClearAll = () => {
    setFiles([]);
    setStatus("idle");
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12">
      
      {/* 1. Hero / Upload Section */}
      <div ref={uploadSectionRef} className="scroll-mt-12">
        <HeroUploadSection 
          outputFormat={outputFormat}
          setOutputFormat={setOutputFormat}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          keepResolution={keepResolution}
          setKeepResolution={setKeepResolution}
          preserveExif={preserveExif}
          setPreserveExif={setPreserveExif}
          quality={quality}
          setQuality={setQuality}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onFileSelect={handleFileInput}
        />
      </div>

      {/* 2. File Status Section */}
      <div ref={progressSectionRef} className="scroll-mt-24">
        <FileStatusSection 
          outputFormat={outputFormat}
          status={status}
          files={files}
          onDownloadAll={handleDownloadAll}
          onDownloadOne={handleDownloadOne}
          onClearAll={handleClearAll}
          onCancel={handleCancel}
        />
      </div>

      
      {/* 3. Format Explanation and Privacy Sections removed as requested */}

      {/* 5. Tool FAQ Section (Placeholder) */}
      {/* Note: Main FAQ usually handled by CMS block, but here is a simple inline one if needed */}
    </div>
  );
}


// --- Sub-Components ---

function HeroUploadSection({
  outputFormat,
  setOutputFormat,
  isSettingsOpen,
  setIsSettingsOpen,
  keepResolution,
  setKeepResolution,
  preserveExif,
  setPreserveExif,
  quality,
  setQuality,
  onDrop,
  onDragOver,
  onFileSelect
}: any) {
  return (
    <section className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          <span className="text-foreground">Free Unlimited </span>
          <span className="text-[#489aee]">
            HEIC to {outputFormat}
          </span>
          <span className="text-foreground"> Converter</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Fast, private HEIC to {outputFormat} conversion — processed locally in your browser.
        </p>
      </div>

      {/* Upload Area */}
      <div 
        className="group relative border-2 border-dashed border-muted-foreground/25 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 rounded-3xl p-10 transition-all duration-200 cursor-pointer"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => document.getElementById('hidden-file-input')?.click()}
      >
        <input 
          id="hidden-file-input"
          type="file" 
          multiple 
          accept=".heic,.heif" 
          className="hidden" 
          onChange={onFileSelect}
        />
        
        <div className="flex flex-col items-center gap-6">
          <div className="bg-background p-4 rounded-full shadow-lg group-hover:scale-110 transition-transform duration-200">
             <UploadCloud className="w-10 h-10 text-[#489aee]" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-semibold">Drag & drop HEIC files or click to upload</p>
            <p className="text-sm text-muted-foreground">
              Supports .heic, .heif • No file size limit
            </p>
          </div>
{/* Button removed as requested */}
        </div>
      </div>

      {/* Controls & Settings */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
        
        {/* Row: Output Format + Advanced Settings Toggle */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          
          {/* Output Format Selector */}
          <div className="flex items-center gap-2 bg-background p-2 px-5 rounded-full border shadow-sm">
             <Label htmlFor="format" className="font-semibold text-sm text-black">Output Format:</Label>
             <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger className="w-[80px] border-none bg-transparent shadow-none focus:ring-0 h-8 font-bold text-black p-0 pl-1">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PNG">PNG</SelectItem>
                <SelectItem value="JPG">JPG</SelectItem>
                <SelectItem value="WebP">WebP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Settings Toggle */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="gap-2 text-black font-semibold hover:text-black/70 hover:bg-transparent"
          >
            <Settings2 className="w-4 h-4" />
            Advanced Settings
            {isSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

        </div>

        {/* Collapsible Content */}
        <Collapsible 
          open={isSettingsOpen} 
          onOpenChange={setIsSettingsOpen}
          className="w-full"
        >
          <CollapsibleContent className="space-y-6 bg-background p-6 rounded-xl border text-sm text-left animate-in slide-in-from-top-2 shadow-sm mt-2">
             <p className="text-muted-foreground text-sm">
               These settings will be applied to all files.
             </p>
             <div className="grid gap-5">
               <div className="flex items-center gap-3">
                 <Checkbox id="res" checked={keepResolution} onCheckedChange={(c) => setKeepResolution(c === true)} className="data-[state=checked]:bg-blue-600 border-input w-5 h-5 rounded" />
                 <Label htmlFor="res" className="text-black font-medium text-base cursor-pointer">Keep original resolution</Label>
               </div>
               
               <div className="flex items-center gap-3">
                 <Checkbox id="exif" checked={preserveExif} onCheckedChange={(c) => setPreserveExif(c === true)} className="data-[state=checked]:bg-blue-600 border-input w-5 h-5 rounded" />
                 <Label htmlFor="exif" className="text-black font-medium text-base cursor-pointer">Preserve EXIF metadata</Label>
               </div>

               <div className="space-y-3 pt-2">
                   <Label className="text-black font-semibold text-base">Compression level: {quality}%</Label>
                   <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={quality} 
                      onChange={(e) => setQuality(parseInt(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      style={{
                        background: `linear-gradient(to right, #2563eb ${quality}%, #e5e7eb ${quality}%)`
                      }}
                   />
                   <style jsx>{`
                     input[type=range]::-webkit-slider-thumb {
                       -webkit-appearance: none;
                       height: 20px;
                       width: 20px;
                       border-radius: 50%;
                       background: #ffffff;
                       border: 2px solid #2563eb;
                       cursor: pointer;
                       box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                       margin-top: -1px; /* Align vertical center if needed */
                     }
                     input[type=range]::-moz-range-thumb {
                       height: 20px;
                       width: 20px;
                       border-radius: 50%;
                       background: #ffffff;
                       border: 2px solid #2563eb;
                       cursor: pointer;
                       box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                     }
                   `}</style>
               </div>
             </div>
          </CollapsibleContent>
        </Collapsible>

      </div>
    </section>
  );
}

function FileStatusSection({ status, files, onDownloadAll, onClearAll, outputFormat, onDownloadOne, onCancel }: any) {
  const [showDetails, setShowDetails] = useState(false);

  if (status === "idle" || status === "adding") return null;

  const totalFiles = files.length;
  // Calculate counts for UI
  const successCount = files.filter((f: HeicFile) => f.status === "success").length;
  const errorCount = files.filter((f: HeicFile) => f.status === "error").length;
  const doneCount = successCount + errorCount;
  
  // Calculate average progress safely
  const totalProgress = files.reduce((acc: number, curr: HeicFile) => {
    return acc + (typeof curr.progress === 'number' ? curr.progress : 0);
  }, 0);
  
  const averageProgress = totalFiles > 0 ? totalProgress / totalFiles : 0;
  // Clamp display value and round it
  const displayProgress = Math.min(100, Math.max(0, Math.round(averageProgress)));

  return (
    <section className="bg-background border rounded-2xl shadow-sm animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
      
      {status === 'converting' ? (
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-start justify-between">
             <div className="space-y-1">
               <h3 className="text-xl font-bold text-foreground">Converting files...</h3>
               <p className="text-muted-foreground">{doneCount} of {totalFiles} completed</p>
             </div>
             <div className="flex items-center gap-4">
                <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={onCancel}
                   className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                >
                  Cancel
                </Button>
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
             </div>
          </div>
          
          <div className="space-y-2">
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-blue-600 transition-all duration-300 ease-out absolute left-0 top-0 bottom-0"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>

          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors font-medium"
          >
            {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Show file details
          </button>
        </div>
      ) : status === 'cancelled' ? (
        <div className="p-10 md:p-12 flex flex-col items-center justify-center text-center space-y-6">
           <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shadow-lg shadow-red-100 dark:shadow-none">
              <AlertCircle className="w-8 h-8 text-red-500 stroke-[3]" />
           </div>

           <div className="space-y-2">
             <h3 className="text-3xl font-bold text-foreground">Conversion Cancelled</h3>
             <p className="text-muted-foreground text-lg">
               The operation was cancelled by the user.
             </p>
           </div>

           <div className="flex flex-wrap items-center justify-center gap-4 pt-4 w-full">
               <Button variant="outline" size="lg" onClick={onClearAll} className="h-12 px-8 text-base w-full sm:w-auto border-gray-200 hover:bg-gray-50 text-gray-700">
                  Try Again
               </Button>
           </div>
        </div>
      ) : (
        <div className="p-10 md:p-12 flex flex-col items-center justify-center text-center space-y-6">
           <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-100">
              <Check className="w-8 h-8 text-white stroke-[3]" />
           </div>

           <div className="space-y-2">
             <h3 className="text-3xl font-bold text-foreground">Conversion Complete!</h3>
             <p className="text-muted-foreground text-lg">
               {successCount} file{successCount !== 1 ? 's' : ''} successfully converted to {outputFormat || 'PNG'}
             </p>
           </div>

           <div className="flex flex-wrap items-center justify-center gap-4 pt-4 w-full">
               {files.length > 1 ? (
                  <Button size="lg" onClick={onDownloadAll} className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 text-base shadow-md w-full sm:w-auto">
                      <FileArchive className="mr-2 w-5 h-5" /> Download All (ZIP)
                  </Button>
               ) : (
                  files[0] && (
                    <Button size="lg" onClick={() => onDownloadOne && onDownloadOne(files[0])} className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-8 text-base shadow-md w-full sm:w-auto">
                        <Download className="mr-2 w-5 h-5" /> Download {outputFormat || 'PNG'}
                    </Button>
                  )
               )}

               <Button variant="outline" size="lg" onClick={onClearAll} className="h-12 px-8 text-base w-full sm:w-auto border-gray-200 hover:bg-gray-50 text-gray-700">
                  Convert More Files
               </Button>
           </div>
        </div>
      )}

      {/* Details List */}
      {showDetails && (
        <div className="border-t bg-muted/5 max-h-[300px] overflow-y-auto divide-y animate-in slide-in-from-top-2">
          {files.map((file: HeicFile) => (
            <div key={file.id} className="p-3 px-6 flex items-center gap-4 hover:bg-muted/30 text-sm">
              <div className="h-8 w-8 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center shrink-0">
                <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.file.name}</p>
              </div>
              <div className="shrink-0">
                 {file.status === 'pending' && <Badge variant="outline" className="text-[10px]">Wait</Badge>}
                 {file.status === 'converting' && <span className="text-blue-500 text-xs font-medium">Processing...</span>}
                 {file.status === 'success' && <div className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5"/> Done</div>}
                 {file.status === 'error' && <div className="flex items-center gap-1 text-red-500 text-xs font-medium"><AlertCircle className="w-3.5 h-3.5"/> Failed</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
