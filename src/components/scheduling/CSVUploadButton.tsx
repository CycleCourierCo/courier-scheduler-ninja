import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface CSVUploadButtonProps {
  onFileSelect: (content: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const CSVUploadButton: React.FC<CSVUploadButtonProps> = ({ 
  onFileSelect, 
  isLoading = false,
  disabled = false 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onFileSelect(content);
    };
    reader.readAsText(file);

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className="flex items-center gap-2"
      >
        <Upload className="h-4 w-4" />
        {isLoading ? 'Processing...' : 'Upload Route CSV'}
      </Button>
    </>
  );
};

export default CSVUploadButton;
