import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, Upload, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { GeolocationData } from '@/types/checkin';

interface CheckinFormProps {
  onSubmit: (fuelPhoto: File, uniformPhoto: File, location: GeolocationData) => Promise<void>;
  isSubmitting: boolean;
}

export function CheckinForm({ onSubmit, isSubmitting }: CheckinFormProps) {
  const [fuelPhoto, setFuelPhoto] = useState<File | null>(null);
  const [uniformPhoto, setUniformPhoto] = useState<File | null>(null);
  const [fuelPreview, setFuelPreview] = useState<string | null>(null);
  const [uniformPreview, setUniformPreview] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

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

  const getCurrentLocation = (): Promise<GeolocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let message = 'Unable to get your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location permission denied. Please enable location access to check in.';
              setLocationPermissionDenied(true);
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable. Please ensure GPS is enabled.';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out. Please try again.';
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const handleSubmit = async () => {
    if (!fuelPhoto || !uniformPhoto) {
      toast.error('Please upload both photos');
      return;
    }

    setIsRequestingLocation(true);
    
    try {
      const location = await getCurrentLocation();
      await onSubmit(fuelPhoto, uniformPhoto, location);
      
      // Clean up previews
      if (fuelPreview) URL.revokeObjectURL(fuelPreview);
      if (uniformPreview) URL.revokeObjectURL(uniformPreview);
    } catch (error) {
      console.error('Check-in submission error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const canSubmit = fuelPhoto && uniformPhoto && !isSubmitting && !isRequestingLocation;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Check-In</CardTitle>
        <CardDescription>Upload your fuel level and uniform photos before 8:15 AM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {locationPermissionDenied && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Location Access Required</AlertTitle>
            <AlertDescription>
              You must enable location permissions to submit your check-in. 
              This ensures you're at the depot. Please enable location in your browser settings.
            </AlertDescription>
          </Alert>
        )}
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
          size="lg"
        >
          {isRequestingLocation ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting your location...
            </>
          ) : isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Submit Check-In
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
