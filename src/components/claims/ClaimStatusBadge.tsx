import { Badge } from "@/components/ui/badge";
import { CLAIM_STATUSES, type ClaimStatus } from "@/services/claimsService";
import { cn } from "@/lib/utils";

interface Props {
  status: ClaimStatus;
  className?: string;
}

const ClaimStatusBadge = ({ status, className }: Props) => {
  const meta = CLAIM_STATUSES.find((s) => s.value === status);
  return (
    <Badge className={cn("border-transparent", meta?.tone, className)}>
      {meta?.label ?? status}
    </Badge>
  );
};

export default ClaimStatusBadge;
