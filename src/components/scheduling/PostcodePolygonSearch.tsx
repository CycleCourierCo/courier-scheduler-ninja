
import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { isPointInPolygon, segmentGeoJSON } from './JobMap';
import { toast } from 'sonner';

const PostcodePolygonSearch = () => {
  const [postcode, setPostcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [polygonSegment, setPolygonSegment] = useState<number | null>(null);

  const searchPostcode = async () => {
    if (!postcode) {
      toast.error('Please enter a postcode');
      return;
    }

    setLoading(true);
    try {
      // Use OpenStreetMap's Nominatim API to geocode the postcode
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)},UK`
      );
      const data = await response.json();

      if (data && data[0]) {
        const { lat, lon } = data[0];
        
        // Find which polygon the coordinates belong to
        for (let i = 0; i < segmentGeoJSON.features.length; i++) {
          const polygon = segmentGeoJSON.features[i].geometry.coordinates[0];
          if (isPointInPolygon([parseFloat(lon), parseFloat(lat)], polygon)) {
            setPolygonSegment(i + 1);
            toast.success(`Location found in Polygon ${i + 1}`);
            return;
          }
        }
        toast.error('Location not found in any polygon');
        setPolygonSegment(null);
      } else {
        toast.error('Postcode not found');
        setPolygonSegment(null);
      }
    } catch (error) {
      console.error('Error searching postcode:', error);
      toast.error('Error searching postcode');
      setPolygonSegment(null);
    } finally {
      setLoading(false);
    }
  };

  const getPolygonBadgeVariant = (segment: number) => {
    return `p${segment}-segment` as const;
  };

  return (
    <div className="bg-card border rounded-lg p-4 mb-8">
      <h2 className="text-lg font-semibold mb-4">Polygon Finder</h2>
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <Input
            placeholder="Enter UK postcode..."
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className="w-full"
          />
        </div>
        <Button 
          onClick={searchPostcode} 
          disabled={loading}
          className="shrink-0"
        >
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>
      </div>
      
      {polygonSegment && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Found in:</span>
          <Badge variant={getPolygonBadgeVariant(polygonSegment)}>
            P{polygonSegment}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default PostcodePolygonSearch;
