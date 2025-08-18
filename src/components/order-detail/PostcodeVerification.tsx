import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

interface PostcodeVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (postcode: string) => void;
  type: "collection" | "delivery";
  expectedPostcode: string;
}

const PostcodeVerification: React.FC<PostcodeVerificationProps> = ({
  isOpen,
  onClose,
  onVerify,
  type,
  expectedPostcode
}) => {
  const [inputPostcode, setInputPostcode] = useState("");
  const [error, setError] = useState("");

  const handleVerify = () => {
    const normalizedInput = inputPostcode.replace(/\s/g, "").toLowerCase();
    const normalizedExpected = expectedPostcode.replace(/\s/g, "").toLowerCase();
    
    if (normalizedInput === normalizedExpected) {
      onVerify(inputPostcode);
      setInputPostcode("");
      setError("");
      onClose();
    } else {
      setError("Incorrect postcode. Please try again.");
    }
  };

  const handleClose = () => {
    setInputPostcode("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Verify {type === "collection" ? "Collection" : "Delivery"} Postcode
          </DialogTitle>
          <DialogDescription>
            To view the proof of {type} images, please enter the {type} postcode.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="postcode" className="text-right">
              Postcode
            </Label>
            <Input
              id="postcode"
              value={inputPostcode}
              onChange={(e) => setInputPostcode(e.target.value)}
              className="col-span-3"
              placeholder="Enter postcode"
              onKeyPress={(e) => e.key === "Enter" && handleVerify()}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleVerify}>
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PostcodeVerification;