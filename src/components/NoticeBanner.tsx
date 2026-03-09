import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface NoticeBar {
  id: string;
  message: string;
  type: string;
}

const typeConfig: Record<string, { bg: string; icon: typeof Info }> = {
  info: { bg: "bg-blue-600 text-white", icon: Info },
  warning: { bg: "bg-amber-500 text-white", icon: AlertTriangle },
  success: { bg: "bg-green-600 text-white", icon: CheckCircle },
  error: { bg: "bg-destructive text-destructive-foreground", icon: AlertCircle },
};

const NoticeBanner = () => {
  const [notices, setNotices] = useState<NoticeBar[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchNotices = async () => {
      const { data } = await supabase
        .from("notice_bars" as any)
        .select("id, message, type")
        .eq("is_active", true)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());
      if (data) setNotices(data as any);
    };
    fetchNotices();
  }, []);

  const visibleNotices = notices.filter((n) => !dismissed.has(n.id));
  if (visibleNotices.length === 0) return null;

  return (
    <div className="w-full z-[60]">
      {visibleNotices.map((notice) => {
        const config = typeConfig[notice.type] || typeConfig.info;
        const Icon = config.icon;
        return (
          <div key={notice.id} className={`${config.bg} px-4 py-2 flex items-center justify-center gap-2 text-sm`}>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-center flex-1">{notice.message}</span>
            <button
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
