import React, { useState } from "react";
import { User, Mail, Phone, MapPin, FileText, Edit2, Save, X } from "lucide-react";
import { ContactInfo, Address } from "@/types/order";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    email: contact.email,
    phone: contact.phone
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
      
      // Update only email and phone
      const updatedContact = {
        ...currentOrder[fieldName],
        email: editedContact.email,
        phone: editedContact.phone
      };
      
      const { error } = await supabase
        .from('orders')
        .update({ [fieldName]: updatedContact })
        .eq('id', orderId);
      
      if (error) throw error;
      
      toast.success(`${type === "sender" ? "Sender" : "Receiver"} contact updated successfully`);
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
      email: contact.email,
      phone: contact.phone
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
        <p className="font-medium text-gray-800">{contact.name}</p>
        <div className="space-y-3">
          <div className="flex items-start space-x-2">
            <Mail className="h-4 w-4 mt-1 text-gray-500" />
            {isEditing ? (
              <div className="flex-1">
                <Label htmlFor={`${type}-email`} className="text-sm">Email</Label>
                <Input
                  id={`${type}-email`}
                  type="email"
                  value={editedContact.email}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1"
                />
              </div>
            ) : (
              <p>{contact.email}</p>
            )}
          </div>
          
          <div className="flex items-start space-x-2">
            <Phone className="h-4 w-4 mt-1 text-gray-500" />
            {isEditing ? (
              <div className="flex-1">
                <Label htmlFor={`${type}-phone`} className="text-sm">Phone</Label>
                <Input
                  id={`${type}-phone`}
                  type="tel"
                  value={editedContact.phone}
                  onChange={(e) => setEditedContact(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1"
                />
              </div>
            ) : (
              <p>{contact.phone}</p>
            )}
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
      </div>
    </div>
  );
};

export default AdminContactEditor;
