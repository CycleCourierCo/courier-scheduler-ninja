
import React from "react";
import { User, Mail, Phone, MapPin, FileText } from "lucide-react";
import { ContactInfo, Address } from "@/types/order";

interface ContactDetailsProps {
  type: "sender" | "receiver";
  contact: ContactInfo & { address: Address };
  notes?: string;
}

const ContactDetails: React.FC<ContactDetailsProps> = ({ type, contact, notes }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <User className="text-courier-600" />
        <h3 className="font-semibold text-lg">
          {type === "sender" ? "Sender" : "Receiver"} Information
        </h3>
      </div>
      <div className="bg-gray-50 p-4 rounded-md space-y-3">
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
      </div>
    </div>
  );
};

export default ContactDetails;
