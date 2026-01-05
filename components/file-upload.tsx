/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CloudUpload, 
  X, 
  FileText, 
  Loader2, 
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadCompleteResult {
  fileName: string;
  name: string;
  fileUrl: string;
}

interface FileUploadProps {
  onUploadComplete: (result: UploadCompleteResult) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
  maxSize?: number;
  accept?: string;
  className?: string;
  multiple?: boolean;
  maxFiles?: number;
}

interface UploadingFile {
  file: File;
  progress: number;
  id: string;
}

export function FileUpload({
  onUploadComplete,
  onUploadError,
  disabled = false,
  maxSize = 16,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp,.csv',
  className,
  multiple = false,
  maxFiles = 5,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: File[]) => {
    if (disabled) return;

    // Check if adding these files would exceed the max files limit
    if (uploadingFiles.length + files.length > maxFiles) {
      onUploadError(`Cannot upload more than ${maxFiles} files at once`);
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxSize * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      onUploadError(`${oversizedFiles.length} file(s) exceed ${maxSize}MB limit`);
      return;
    }

    // Create uploading file objects
    const newUploadingFiles = files.map(file => ({
      file,
      progress: 0,
      id: Math.random().toString(36).substring(7),
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload files sequentially to avoid overwhelming the server
    uploadFilesSequentially(newUploadingFiles);
  };

  const uploadFilesSequentially = async (filesToUpload: UploadingFile[]) => {
    for (const uploadingFile of filesToUpload) {
      await uploadFile(uploadingFile);
    }
  };

  const uploadFile = async (uploadingFile: UploadingFile) => {
    try {
      const formData = new FormData();
      formData.append('file', uploadingFile.file);

      // Create progress tracking interval
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => prev.map(file => 
          file.id === uploadingFile.id 
            ? { ...file, progress: Math.min(file.progress + 10, 90) }
            : file
        ));
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      // Set progress to 100%
      setUploadingFiles(prev => prev.map(file => 
        file.id === uploadingFile.id 
          ? { ...file, progress: 100 }
          : file
      ));

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }
      
      if (result.success && result.fileName && result.fileUrl) {
        // Call completion handler for this file
        onUploadComplete({
          fileName: result.fileName,
          name: result.originalName || uploadingFile.file.name,
          fileUrl: result.fileUrl,
        });

        // Remove this file from uploading list after a short delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(file => file.id !== uploadingFile.id));
        }, 1000);
      } else {
        throw new Error(result.error || 'Upload failed: Invalid server response');
      }
    } catch (error) {
      // Remove failed upload from list
      setUploadingFiles(prev => prev.filter(file => file.id !== uploadingFile.id));
      onUploadError(`Failed to upload ${uploadingFile.file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const filesToUpload = multiple ? files.slice(0, maxFiles) : [files[0]];
      handleFileSelect(filesToUpload);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const filesToUpload = multiple ? files.slice(0, maxFiles) : [files[0]];
      handleFileSelect(filesToUpload);
    }
  };

  const cancelUpload = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const isUploading = uploadingFiles.length > 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg px-2 py-4 text-center transition-all duration-300 cursor-pointer h-full flex flex-col items-center justify-center",
          isDragOver && !disabled
            ? "border-primary bg-secondary/50"
            : "border-border hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {isUploading ? (
           <div className="w-full h-full overflow-y-auto px-2 space-y-2 flex flex-col justify-center">
             {uploadingFiles.map((uploadingFile) => (
               <div key={uploadingFile.id} className="flex items-center gap-2 w-full">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] truncate mb-1 text-left">{uploadingFile.file.name}</p>
                    <Progress value={uploadingFile.progress} className="h-1" />
                  </div>
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
               </div>
             ))}
           </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <CloudUpload className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium px-2">
                {multiple 
                  ? `Upload up to ${maxFiles} files`
                  : 'Upload File'
                }
              </p>
              <p className="text-[10px] text-muted-foreground">
                Max: {maxSize}MB
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface UploadedFileDisplayProps {
  fileName: string;
  name: string;
  fileUrl: string | null;
  onRemove: () => void;
  disabled?: boolean;
  variant?: 'default' | 'banner';
}

export function UploadedFileDisplay({
  name,
  fileUrl,
  onRemove,
  disabled = false,
  variant = 'default',
}: UploadedFileDisplayProps) {
  // Determine potential file type
  const fileExtension = (name.split('.').pop()?.toLowerCase() || '') || (fileUrl?.split('.').pop()?.toLowerCase() || '');
  const isVideo = ['mp4', 'webm', 'mov'].includes(fileExtension);
  // Initial guess for image
  const initialIsImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension) || fileUrl?.startsWith('data:image') || fileUrl?.startsWith('blob:');
  
  const [imageError, setImageError] = React.useState(false);

  const shouldShowImage = (initialIsImage || !fileExtension) && fileUrl && !imageError && !isVideo;

  if (variant === 'banner' && shouldShowImage) {
      return (
        <Card className="relative w-full h-full overflow-hidden border border-white/10 bg-neutral-900 group">
           {/* Background Image */}
           <div className="absolute inset-0">
              <img 
                src={fileUrl!} 
                alt={name} 
                className="w-full h-full object-cover opacity-60 transition-opacity group-hover:opacity-40"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-black/40" />
           </div>

           {/* Centered Action */}
           <div className="absolute inset-0 flex items-center justify-center">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onRemove}
                disabled={disabled}
                className="shadow-lg bg-white text-black hover:bg-neutral-200"
              >
                 <CloudUpload className="mr-2 h-4 w-4" />
                 Change Image
              </Button>
           </div>
           
           {/* FileName (Optional, visible on hover or always?) */}
           <div className="absolute bottom-2 left-2 right-2">
              <p className="text-[10px] text-white/50 truncate text-center">{name}</p>
           </div>
        </Card>
      );
  }

  const renderPreview = () => {
    if (shouldShowImage) {
      return (
        <div className="relative w-16 h-16 flex-shrink-0 bg-neutral-900 rounded-md overflow-hidden border border-white/10">
          <img 
            src={fileUrl!} 
            alt={name} 
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }
    
    if (isVideo && fileUrl) {
      return (
        <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center border border-white/10 rounded bg-neutral-900">
          <Video className="h-8 w-8 text-neutral-400" />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center w-16 h-16 flex-shrink-0 border border-white/10 rounded bg-neutral-900">
        <FileText className="h-6 w-6 text-neutral-400" />
      </div>
    );
  };

  return (
    <Card className="border border-white/10 bg-neutral-900 overflow-hidden w-full">
      <CardContent className="p-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {renderPreview()}
            <p className="text-xs font-medium truncate text-neutral-300">
              {name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="flex-shrink-0 h-6 w-6 p-0 hover:text-red-400 hover:bg-neutral-800 rounded-full"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}