import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";

interface PostcodeVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Submits the postcode to the server. The server decides whether the
   * postcode is correct — this component never compares strings locally.
   * Resolve to a result describing the outcome.
   */
  onSubmit: (postcode: string) => Promise<{ verified: boolean; rateLimited: boolean }>;
  type: "collection" | "delivery";
}

const PostcodeVerification: React.FC<PostcodeVerificationProps> = ({
  isOpen,
  onClose,
  onSubmit,
  type,
}) => {
  const [inputPostcode, setInputPostcode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    if (!inputPostcode.trim()) {
      setError("Please enter a postcode.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await onSubmit(inputPostcode.trim());
      if (result.rateLimited) {
        setError("Too many attempts. Please try again in a few minutes.");
        return;
      }
      if (!result.verified) {
        setError(`Incorrect ${type} postcode. Please try again.`);
        return;
      }
      // Verified — close the dialog
      setInputPostcode("");
      setError("");
      onClose();
    } catch (e) {
      setError("Verification failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
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
              disabled={submitting}
              onKeyPress={(e) => e.key === "Enter" && !submitting && handleVerify()}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PostcodeVerification;
