import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Files } from "lucide-react";

export interface UploadedFile {
  fileName: string;
  content: string;
}

interface MultiCSVUploadButtonProps {
  onFilesSelect: (files: UploadedFile[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const MultiCSVUploadButton: React.FC<MultiCSVUploadButtonProps> = ({ 
  onFilesSelect, 
  isLoading = false,
  disabled = false 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const uploadedFiles: UploadedFile[] = [];
    
    // Read all files
    const readPromises = Array.from(files).map(file => {
      return new Promise<UploadedFile | null>((resolve) => {
        // Validate file type
        if (!file.name.endsWith('.csv')) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          resolve({
            fileName: file.name,
            content
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      });
    });

    const results = await Promise.all(readPromises);
    const validFiles = results.filter((f): f is UploadedFile => f !== null);
    
    if (validFiles.length > 0) {
      onFilesSelect(validFiles);
    }

    // Reset input so the same files can be selected again
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className="flex items-center gap-2"
      >
        <Files className="h-4 w-4" />
        {isLoading ? 'Processing...' : 'Compare Routes'}
      </Button>
    </>
  );
};

export default MultiCSVUploadButton;
