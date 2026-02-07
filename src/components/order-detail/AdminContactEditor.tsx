import React, { useState } from "react";
import { User, Mail, Phone, MapPin, FileText, Edit2, Save, X } from "lucide-react";
import { ContactInfo, Address } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress, buildAddressString } from "@/utils/geocoding";

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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const fieldName = type === "sender" ? "sender" : "receiver";
      
      // Get the current contact data
      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders')
        .select(fieldName)
        .eq('id', orderId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Build address string and geocode
      const addressString = buildAddressString({
        street: editedContact.street,
        city: editedContact.city,
        state: editedContact.state,
        zipCode: editedContact.zipCode,
        country: editedContact.country
      });
      
      const coordinates = await geocodeAddress(addressString);
      
      // Update all fields including coordinates
      const updatedContact = {
        ...currentOrder[fieldName],
        name: editedContact.name,
        email: editedContact.email,
        phone: editedContact.phone,
        address: {
          ...currentOrder[fieldName].address,
          street: editedContact.street,
          city: editedContact.city,
          state: editedContact.state,
          zipCode: editedContact.zipCode,
          country: editedContact.country,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <User className="text-courier-600" />
          <h3 className="font-semibold text-lg">
            {type === "sender" ? "Sender" : "Receiver"} Information
          </h3>
        </div>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit Contact
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>
      
      <div className="bg-gray-50 p-4 rounded-md space-y-3">
        {isEditing ? (
          <div className="space-y-4">
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
            <p className="font-medium text-gray-800">{contact.name}</p>
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Mail className="h-4 w-4 mt-1 text-gray-500" />
                <p>{contact.email}</p>
              </div>
              <div className="flex items-start space-x-2">
                <Phone className="h-4 w-4 mt-1 text-gray-500" />
                <p>{contact.phone}</p>
              </div>
              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                <div>
                  <p>{contact.address.street}</p>
                  <p>{contact.address.city}, {contact.address.state} {contact.address.zipCode}</p>
                  <p>{contact.address.country}</p>
                </div>
              </div>
              {notes && (
                <div className="flex items-start space-x-2 mt-2 pt-2 border-t border-gray-200">
                  <FileText className="h-4 w-4 mt-1 text-gray-500" />
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
