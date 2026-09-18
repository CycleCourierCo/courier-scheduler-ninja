import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";

export interface SelectedAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  /** UK constituent country (England / Wales / Scotland / Northern Ireland) */
  region: string;
  lat?: number;
  lon?: number;
}

interface AddressSuggestion {
  properties: {
    formatted: string;
    street?: string;
    housenumber?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    lat?: number;
    lon?: number;
  };
}

interface AddressSearchInputProps {
  onSelect: (address: SelectedAddress) => void;
  /** Called when the user chooses to type the address themselves. */
  onManualEntry?: () => void;
  /** Called when the search box is focused, before a new search begins. */
  onSearchStart?: () => void;
  label?: string;
  placeholder?: string;
  showManualEntry?: boolean;
}

const AddressSearchInput: React.FC<AddressSearchInputProps> = ({
  onSelect,
  onManualEntry,
  onSearchStart,
  label = "Search Address",
  placeholder = "Search for an address in the UK...",
  showManualEntry = true,
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchAddressSuggestions = async (text: string) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&filter=countrycode:gb&apiKey=${apiKey}`;

      const response = await fetch(url, { method: "GET" });
      const data = await response.json();

      if (data && data.features && Array.isArray(data.features)) {
        setSuggestions(data.features);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
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
    const houseNumber = suggestion.properties.housenumber || "";
    const street = suggestion.properties.street || "";
    const fullStreetAddress = houseNumber
      ? `${houseNumber} ${street}`.trim()
      : street.trim();

    onSelect({
      street: fullStreetAddress,
      city: suggestion.properties.city || suggestion.properties.county || "",
      state: suggestion.properties.county || "",
      zipCode: suggestion.properties.postcode || "",
      country: suggestion.properties.country || "",
      // Geoapify returns the UK constituent country ("England", "Wales",
      // "Scotland", "Northern Ireland") in `state` — keep it for NI routing.
      region: suggestion.properties.state || "",
      lat: suggestion.properties.lat,
      lon: suggestion.properties.lon,
    });

    setSearchValue("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleManualEntry = () => {
    setShowSuggestions(false);
    onManualEntry?.();
  };

  return (
    <div className="relative">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <div className="relative">
          <Input
            placeholder={placeholder}
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
              onSearchStart?.();
              if (searchValue.length >= 3 && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            className="pl-8 mt-1"
          />
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        {showSuggestions && (
          <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md shadow-lg border max-h-60 overflow-auto">
            {loading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && suggestions.length === 0 && (
              <div className="py-3 px-4 text-sm text-muted-foreground">No address found.</div>
            )}

            {!loading && suggestions.length > 0 && (
              <ul>
                {suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="px-4 py-2 text-sm hover:bg-accent cursor-pointer"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion.properties.formatted}
                  </li>
                ))}
              </ul>
            )}

            {showManualEntry && (
              <div className="p-2 border-t">
                <Button
                  variant="link"
                  type="button"
                  onClick={handleManualEntry}
                  className="w-full text-sm"
                >
                  Enter address manually
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressSearchInput;
