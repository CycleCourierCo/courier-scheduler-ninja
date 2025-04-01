
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Control, UseFormSetValue } from "react-hook-form";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddressFormProps {
  control: Control<any>;
  prefix: string;
  setValue: UseFormSetValue<any>;
}

interface AddressSuggestion {
  properties: {
    formatted: string;
    street: string;
    housenumber?: string;
    city: string;
    county: string;
    state: string;
    postcode: string;
    country: string;
    lat?: number;
    lon?: number;
  };
}

const AddressForm: React.FC<AddressFormProps> = ({ control, prefix, setValue }) => {
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false);

  // Check if address fields have values to determine if they should be shown
  useEffect(() => {
    const checkFormValues = () => {
      const streetValue = control._formValues[`${prefix}.street`];
      if (streetValue && streetValue.length > 0) {
        setAddressSelected(true);
      }
    };
    
    // Add a small delay to ensure form values are updated after tab changes
    const timeoutId = setTimeout(checkFormValues, 100);
    return () => clearTimeout(timeoutId);
  }, [control, prefix]);

  const fetchAddressSuggestions = async (text: string) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      return;
    }
    
    setLoading(true);
    try {
      // Direct API call to Geoapify
      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&filter=countrycode:gb&apiKey=${apiKey}`;
      
      const response = await fetch(url, { method: "GET" });
      const data = await response.json();
      
      // Only if we have valid features, add them to suggestions
      if (data && data.features && Array.isArray(data.features)) {
        setSuggestions(data.features);
      } else {
        console.warn("Geoapify API response doesn't contain the expected features array:", data);
        setSuggestions([]);
      }
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchValue && searchValue.length >= 3) {
        fetchAddressSuggestions(searchValue);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    // Create a complete street address with house number if available
    const houseNumber = suggestion.properties.housenumber || "";
    const street = suggestion.properties.street || "";
    const fullStreetAddress = houseNumber 
      ? `${houseNumber} ${street}`.trim() 
      : street.trim();
    
    setValue(`${prefix}.street`, fullStreetAddress);
    setValue(`${prefix}.city`, suggestion.properties.city || suggestion.properties.county || "");
    setValue(`${prefix}.state`, suggestion.properties.county || ""); // Changed to use county instead of state
    setValue(`${prefix}.zipCode`, suggestion.properties.postcode || "");
    setValue(`${prefix}.country`, suggestion.properties.country || "");
    
    // Store latitude and longitude coordinates
    if (suggestion.properties.lat !== undefined && suggestion.properties.lon !== undefined) {
      setValue(`${prefix}.latitude`, suggestion.properties.lat);
      setValue(`${prefix}.longitude`, suggestion.properties.lon);
      console.log(`Stored coordinates: Lat: ${suggestion.properties.lat}, Lon: ${suggestion.properties.lon}`);
    } else {
      console.warn("No coordinates found in the address suggestion");
    }
    
    setSearchValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    setAddressSelected(true);
  };

  const handleManualEntry = () => {
    setAddressSelected(true);
    setShowSuggestions(false);
  };

  const handleSearchClick = () => {
    // Clear form fields
    setValue(`${prefix}.street`, "");
    setValue(`${prefix}.city`, "");
    setValue(`${prefix}.state`, "");
    setValue(`${prefix}.zipCode`, "");
    setValue(`${prefix}.country`, "");
    setValue(`${prefix}.latitude`, undefined);
    setValue(`${prefix}.longitude`, undefined);
    
    // Hide address fields
    setAddressSelected(false);
    
    // Focus on search
    setSearchValue("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4">
      <div className="relative mb-4">
        <FormLabel className="text-sm font-medium">Search Address</FormLabel>
        <div className="relative">
          <div className="relative">
            <Input
              placeholder="Search for an address in the UK..."
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                if (e.target.value.length >= 3) {
                  setShowSuggestions(true);
                } else {
                  setShowSuggestions(false);
                  setSuggestions([]);
                }
              }}
              onFocus={() => {
                handleSearchClick(); // Clear and hide address fields when focusing on search
                if (searchValue.length >= 3 && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              className="pl-8"
            />
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>
          
          {showSuggestions && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto">
              {loading && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              )}
              
              {!loading && suggestions.length === 0 && (
                <div className="py-3 px-4 text-sm text-gray-500">No address found.</div>
              )}
              
              {!loading && suggestions.length > 0 && (
                <ul>
                  {suggestions.map((suggestion, index) => (
                    <li 
                      key={index}
                      className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion.properties.formatted}
                    </li>
                  ))}
                </ul>
              )}
              
              <div className="p-2 border-t border-gray-200">
                <Button 
                  variant="link" 
                  type="button" 
                  onClick={handleManualEntry}
                  className="w-full text-sm"
                >
                  Enter address manually
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {addressSelected && (
        <>
          <FormField
            control={control}
            name={`${prefix}.street`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address *</FormLabel>
                <FormControl>
                  <Input placeholder="10 Downing Street" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name={`${prefix}.city`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input placeholder="London" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`${prefix}.state`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>County *</FormLabel>
                  <FormControl>
                    <Input placeholder="Greater London" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name={`${prefix}.zipCode`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postcode *</FormLabel>
                  <FormControl>
                    <Input placeholder="SW1A 2AA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`${prefix}.country`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country *</FormLabel>
                  <FormControl>
                    <Input placeholder="United Kingdom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Hidden fields for coordinates that won't be displayed in the UI */}
          <FormField
            control={control}
            name={`${prefix}.latitude`}
            render={({ field }) => (
              <FormItem className="hidden">
                <FormControl>
                  <Input type="hidden" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          
          <FormField
            control={control}
            name={`${prefix}.longitude`}
            render={({ field }) => (
              <FormItem className="hidden">
                <FormControl>
                  <Input type="hidden" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </>
      )}
    </div>
  );
};

export default AddressForm;
