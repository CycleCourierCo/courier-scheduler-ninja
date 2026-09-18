
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Control, UseFormSetValue, useWatch } from "react-hook-form";
import AddressSearchInput, { SelectedAddress } from "@/components/address/AddressSearchInput";

interface AddressFormProps {
  control: Control<any>;
  prefix: string;
  setValue: UseFormSetValue<any>;
}



const AddressForm: React.FC<AddressFormProps> = ({ control, prefix, setValue }) => {
  const [addressSelected, setAddressSelected] = useState(false);

  // Watch the street field to detect when it's populated
  const streetValue = useWatch({
    control,
    name: `${prefix}.street`,
  });

  // Update addressSelected when street field has a value
  useEffect(() => {
    if (streetValue && streetValue.length > 0) {
      setAddressSelected(true);
    }
  }, [streetValue]);

  const handleAddressSelected = (address: SelectedAddress) => {
    setValue(`${prefix}.street`, address.street);
    setValue(`${prefix}.city`, address.city);
    setValue(`${prefix}.state`, address.state);
    setValue(`${prefix}.zipCode`, address.zipCode);
    setValue(`${prefix}.country`, address.country);
    setValue(`${prefix}.region`, address.region);

    if (address.lat !== undefined && address.lon !== undefined) {
      setValue(`${prefix}.lat`, address.lat);
      setValue(`${prefix}.lon`, address.lon);
    } else {
      setValue(`${prefix}.lat`, undefined);
      setValue(`${prefix}.lon`, undefined);
    }

    setAddressSelected(true);
  };

  const handleSearchStart = () => {
    setValue(`${prefix}.street`, "");
    setValue(`${prefix}.city`, "");
    setValue(`${prefix}.state`, "");
    setValue(`${prefix}.zipCode`, "");
    setValue(`${prefix}.country`, "");
    setValue(`${prefix}.region`, "");
    setValue(`${prefix}.lat`, undefined);
    setValue(`${prefix}.lon`, undefined);

    setAddressSelected(false);
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <AddressSearchInput
          onSelect={handleAddressSelected}
          onManualEntry={() => setAddressSelected(true)}
          onSearchStart={handleSearchStart}
        />
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

          {/* Hidden fields for coordinates that will be part of the form submission */}
          <FormField
            control={control}
            name={`${prefix}.lat`}
            render={({ field }) => (
              <input type="hidden" {...field} />
            )}
          />
          
          <FormField
            control={control}
            name={`${prefix}.lon`}
            render={({ field }) => (
              <input type="hidden" {...field} />
            )}
          />
        </>
      )}
    </div>
  );
};

export default AddressForm;
