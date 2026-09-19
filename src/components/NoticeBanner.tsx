import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface NoticeBar {
  id: string;
  message: string;
  type: string;
  restricted_to_roles: string[] | null;
}

const typeConfig: Record<string, { style: string; icon: typeof Info }> = {
  info: { style: "border-l-primary", icon: Info },
  warning: { style: "chevron-tape border-l-status-waiting", icon: AlertTriangle },
  success: { style: "border-l-status-done", icon: CheckCircle },
  error: { style: "border-l-destructive", icon: AlertCircle },
};

const NoticeBanner = () => {
  const [notices, setNotices] = useState<NoticeBar[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchNotices = async () => {
      const { data } = await supabase
        .from("notice_bars")
        .select("id, message, type, restricted_to_roles")
        .eq("is_active", true)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());
      if (data) setNotices(data);
    };
    fetchNotices();
  }, []);

  const userRole = userProfile?.role as string | undefined;

  const visibleNotices = notices.filter((n) => {
    if (dismissed.has(n.id)) return false;
    // If no role restriction, visible to all
    if (!n.restricted_to_roles || n.restricted_to_roles.length === 0) return true;
    // If restricted, only show to users with matching role
    if (!userRole) return false;
    return n.restricted_to_roles.includes(userRole);
  });

  if (visibleNotices.length === 0) return null;

  return (
    <div className="w-full z-[60]">
      {visibleNotices.map((notice) => {
        const config = typeConfig[notice.type] || typeConfig.info;
        const Icon = config.icon;
        return (
          <div key={notice.id} className={`${config.style} flex min-h-11 items-center justify-center gap-2 border-b border-l-4 bg-card px-4 py-2 text-sm text-card-foreground`}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-center flex-1">{notice.message}</span>
            <button type="button" aria-label="Dismiss notice"
              onClick={() => setDismissed((prev) => new Set(prev).add(notice.id))}
              className="shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default NoticeBanner;
