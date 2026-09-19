import React, { useState } from "react";
import { User, Mail, Phone, MapPin, FileText, Edit2, Save, X, MessageSquare } from "lucide-react";
import { ContactInfo, Address } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress, buildAddressString } from "@/utils/geocoding";
import { ContactSelector } from "@/components/create-order/ContactSelector";
import { useContacts } from "@/hooks/useContacts";
import { Contact } from "@/services/contactService";
import AddressSearchInput, { SelectedAddress } from "@/components/address/AddressSearchInput";


interface AdminContactEditorProps {
  type: "sender" | "receiver";
  contact: ContactInfo & { address: Address };
  notes?: string;
  orderId: string;
  onUpdate: () => void;
}

const AdminContactEditor: React.FC<AdminContactEditorProps> = ({ 
  type, 
  contact, 
  notes, 
  orderId,
  onUpdate 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingReview, setIsSendingReview] = useState(false);
  const [editedContact, setEditedContact] = useState({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    street: contact.address.street,
    city: contact.address.city,
    state: contact.address.state,
    zipCode: contact.address.zipCode,
    country: contact.address.country
  });
  // Populated only when an address is picked from the search — avoids a second
  // geocode call and keeps NI routing accurate after an address change.
  const [searchedAddress, setSearchedAddress] = useState<SelectedAddress | null>(null);
  const { data: allContacts = [], isLoading: contactsLoading } = useContacts(undefined, true);

  const handleSelectContact = (selected: Contact) => {
    setSearchedAddress(null);
    setEditedContact({
      name: selected.name,
      email: selected.email || "",
      phone: selected.phone || "",
      street: selected.street || "",
      city: selected.city || "",
      state: selected.state || "",
      zipCode: selected.postal_code || "",
      country: selected.country || "United Kingdom",
    });
  };

  const handleSelectAddress = (address: SelectedAddress) => {
    setSearchedAddress(address);
    setEditedContact(prev => ({
      ...prev,
      street: address.street,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country || "United Kingdom",
    }));
  };

  // When an address changes we can no longer trust the existing Shipday job, so
  // delete the affected leg's job and let the sync function create a fresh one.
  const rebuildShipdayJob = async (orderRow: any) => {
    const isPickupLeg = type === "sender";
    const existingId = isPickupLeg ? orderRow?.shipday_pickup_id : orderRow?.shipday_delivery_id;
    const legDone = isPickupLeg ? orderRow?.order_collected === true : orderRow?.order_delivered === true;

    if (!existingId || legDone) return;

    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-shipday-order', {
        body: isPickupLeg
          ? { shipdayPickupId: existingId }
          : { shipdayDeliveryId: existingId },
      });

      if (deleteError) {
        toast.warning("Address saved, but the existing delivery job could not be removed. Please re-sync it manually.");
        return;
      }

      const { error: clearError } = await supabase
        .from('orders')
        .update(isPickupLeg ? { shipday_pickup_id: null } : { shipday_delivery_id: null })
        .eq('id', orderId);

      if (clearError) throw clearError;

      const { error: syncError } = await supabase.functions.invoke('sync-order-shipday', {
        body: { orderId, jobType: isPickupLeg ? 'pickup' : 'delivery' },
      });

      if (syncError) {
        toast.warning("Address saved and the old job removed, but creating the new job failed. Please re-sync it manually.");
        return;
      }

      toast.success(`${isPickupLeg ? "Collection" : "Delivery"} job recreated with the new address`);
    } catch (error) {
      console.error("Error rebuilding Shipday job:", error);
      toast.warning("Address saved, but the delivery job could not be rebuilt. Please re-sync it manually.");
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const fieldName = type === "sender" ? "sender" : "receiver";
      
      // Get the current contact data
      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`${fieldName}, shipday_pickup_id, shipday_delivery_id, order_collected, order_delivered, status`)
        .eq('id', orderId)
        .single();
      
      if (fetchError) throw fetchError;

      const orderRow = currentOrder as any;
      const previousAddress = orderRow?.[fieldName]?.address ?? {};
      const addressChanged =
        (previousAddress.street || "") !== editedContact.street ||
        (previousAddress.city || "") !== editedContact.city ||
        (previousAddress.state || "") !== editedContact.state ||
        (previousAddress.zipCode || "") !== editedContact.zipCode ||
        (previousAddress.country || "") !== editedContact.country;
      
      
      // Use the coordinates from the searched address when available, otherwise
      // fall back to geocoding the typed address.
      let coordinates: { lat: number; lon: number } | null = null;
      if (searchedAddress?.lat !== undefined && searchedAddress?.lon !== undefined) {
        coordinates = { lat: searchedAddress.lat, lon: searchedAddress.lon };
      } else {
        const addressString = buildAddressString({
          street: editedContact.street,
          city: editedContact.city,
          state: editedContact.state,
          zipCode: editedContact.zipCode,
          country: editedContact.country
        });

        coordinates = await geocodeAddress(addressString);
      }
      
      // Update all fields including coordinates
      const updatedContact = {
        ...orderRow[fieldName],
        name: editedContact.name,
        email: editedContact.email,
        phone: editedContact.phone,
        address: {
          ...(orderRow[fieldName]?.address ?? {}),
          street: editedContact.street,
          city: editedContact.city,
          state: editedContact.state,
          zipCode: editedContact.zipCode,
          country: editedContact.country,
          // Only overwrite the stored UK constituent country when a search result gave us one
          ...(searchedAddress?.region ? { region: searchedAddress.region } : {}),
          ...(coordinates && { lat: coordinates.lat, lon: coordinates.lon })
        }
      };
      
      const { error } = await supabase
        .from('orders')
        .update({ [fieldName]: updatedContact })
        .eq('id', orderId);
      
      if (error) throw error;
      
      if (coordinates) {
        toast.success(`${type === "sender" ? "Sender" : "Receiver"} contact updated successfully`);
      } else {
        toast.warning(`${type === "sender" ? "Sender" : "Receiver"} contact updated, but coordinates could not be fetched`);
      }
      
      if (addressChanged) {
        await rebuildShipdayJob(orderRow);
      }

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact information");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setSearchedAddress(null);
    setEditedContact({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      street: contact.address.street,
      city: contact.address.city,
      state: contact.address.state,
      zipCode: contact.address.zipCode,
      country: contact.address.country
    });
    setIsEditing(false);
  };

  const handleSendReview = async () => {
    try {
      setIsSendingReview(true);
      const { data, error } = await supabase.functions.invoke('send-sendzen-whatsapp', {
        body: {
          orderId,
          type: "review",
          recipientType: type,
        }
      });

      if (error) {
        toast.error(`Failed to send review: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success(`Review request sent to ${contact.name} via WhatsApp`);
      } else {
        toast.error(`WhatsApp failed: ${data?.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSendingReview(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <User className="text-courier-600 shrink-0" />
          <h3 className="min-w-0 break-words text-lg font-semibold">
            {type === "sender" ? "Sender" : "Receiver"} Information
          </h3>
        </div>
        {!isEditing ? (
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">

            {contact.phone && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleSendReview}
                disabled={isSendingReview}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {isSendingReview ? "Sending..." : "Send Review"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Contact
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="w-full"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>
      
      <div className="bg-muted p-4 rounded-md space-y-3">
        {isEditing ? (
          <div className="space-y-4">
            {/* Contact Selector */}
            <div>
              <Label className="text-sm">Select from address book</Label>
              <div className="mt-1">
                <ContactSelector
                  contacts={allContacts}
                  onSelect={handleSelectContact}
                  isLoading={contactsLoading}
                  placeholder="Choose a saved contact..."
                />
              </div>
            </div>
            {/* Name */}
            <div>
              <Label htmlFor={`${type}-name`} className="text-sm">Name</Label>
              <Input
                id={`${type}-name`}
                value={editedContact.name}
                onChange={(e) => setEditedContact(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            
            {/* Email and Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`${type}-email`} className="text-sm">Email</Label>
                <Input
                  id={`${type}-email`}
                  type="email"
                  value={editedContact.email}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`${type}-phone`} className="text-sm">Phone</Label>
                <Input
                  id={`${type}-phone`}
                  type="tel"
                  value={editedContact.phone}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            
            {/* Address search */}
            <AddressSearchInput
              onSelect={handleSelectAddress}
              showManualEntry={false}
              label="Search Address"
            />

            {/* Street Address */}
            <div>
              <Label htmlFor={`${type}-street`} className="text-sm">Street Address</Label>
              <Input
                id={`${type}-street`}
                value={editedContact.street}
                onChange={(e) => setEditedContact(prev => ({ ...prev, street: e.target.value }))}
                className="mt-1"
              />
            </div>
            
            {/* City and State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`${type}-city`} className="text-sm">City</Label>
                <Input
                  id={`${type}-city`}
                  value={editedContact.city}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, city: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`${type}-state`} className="text-sm">County/State</Label>
                <Input
                  id={`${type}-state`}
                  value={editedContact.state}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, state: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            
            {/* Postcode and Country */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`${type}-zipCode`} className="text-sm">Postcode</Label>
                <Input
                  id={`${type}-zipCode`}
                  value={editedContact.zipCode}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, zipCode: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`${type}-country`} className="text-sm">Country</Label>
                <Input
                  id={`${type}-country`}
                  value={editedContact.country}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, country: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium text-foreground">{contact.name}</p>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <p className="break-all">{contact.email}</p>
              </div>
              <div className="flex items-start space-x-2">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <p>{contact.phone}</p>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p>{contact.address.street}</p>
                  <p>{contact.address.city}, {contact.address.state} {contact.address.zipCode}</p>
                  <p>{contact.address.country}</p>
                </div>
              </div>
              {notes && (
                <div className="flex items-start space-x-2 mt-2 pt-2 border-t border-border">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium mb-1">{type === "sender" ? "Sender" : "Receiver"} Notes:</p>
                    <p className="text-sm whitespace-pre-line">{notes}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminContactEditor;
