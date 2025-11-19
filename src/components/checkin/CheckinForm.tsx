import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Camera, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface CheckinFormProps {
  onSubmit: (fuelPhoto: File, uniformPhoto: File) => Promise<void>;
  isSubmitting: boolean;
}

export function CheckinForm({ onSubmit, isSubmitting }: CheckinFormProps) {
  const [fuelPhoto, setFuelPhoto] = useState<File | null>(null);
  const [uniformPhoto, setUniformPhoto] = useState<File | null>(null);
  const [fuelPreview, setFuelPreview] = useState<string | null>(null);
  const [uniformPreview, setUniformPreview] = useState<string | null>(null);

  const fuelInputRef = useRef<HTMLInputElement>(null);
  const uniformInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    file: File | undefined,
    type: 'fuel' | 'uniform'
  ) => {
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const preview = URL.createObjectURL(file);
    
    if (type === 'fuel') {
      setFuelPhoto(file);
      setFuelPreview(preview);
    } else {
      setUniformPhoto(file);
      setUniformPreview(preview);
    }
  };

  const removePhoto = (type: 'fuel' | 'uniform') => {
    if (type === 'fuel') {
      setFuelPhoto(null);
      if (fuelPreview) URL.revokeObjectURL(fuelPreview);
      setFuelPreview(null);
      if (fuelInputRef.current) fuelInputRef.current.value = '';
    } else {
      setUniformPhoto(null);
      if (uniformPreview) URL.revokeObjectURL(uniformPreview);
      setUniformPreview(null);
      if (uniformInputRef.current) uniformInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!fuelPhoto || !uniformPhoto) {
      toast.error('Please upload both photos');
      return;
    }

    try {
      await onSubmit(fuelPhoto, uniformPhoto);
      // Clean up previews
      if (fuelPreview) URL.revokeObjectURL(fuelPreview);
      if (uniformPreview) URL.revokeObjectURL(uniformPreview);
    } catch (error) {
      console.error('Check-in submission error:', error);
    }
  };

  const canSubmit = fuelPhoto && uniformPhoto && !isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Check-In</CardTitle>
        <CardDescription>Upload your fuel level and uniform photos before 8:15 AM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fuel Photo */}
        <div className="space-y-2">
          <Label htmlFor="fuel-photo">Fuel Level Photo</Label>
          <div className="flex flex-col gap-4">
            <input
              ref={fuelInputRef}
              id="fuel-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0], 'fuel')}
            />
            
            {!fuelPreview ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fuelInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (fuelInputRef.current) {
                      fuelInputRef.current.removeAttribute('capture');
                      fuelInputRef.current.click();
                    }
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={fuelPreview}
                  alt="Fuel level preview"
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removePhoto('fuel')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Uniform Photo */}
        <div className="space-y-2">
          <Label htmlFor="uniform-photo">Uniform Photo</Label>
          <div className="flex flex-col gap-4">
            <input
              ref={uniformInputRef}
              id="uniform-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0], 'uniform')}
            />
            
            {!uniformPreview ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => uniformInputRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (uniformInputRef.current) {
                      uniformInputRef.current.removeAttribute('capture');
                      uniformInputRef.current.click();
                    }
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </Button>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={uniformPreview}
                  alt="Uniform preview"
                  className="w-full h-48 object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removePhoto('uniform')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Check-In'}
        </Button>
      </CardContent>
    </Card>
  );
}
