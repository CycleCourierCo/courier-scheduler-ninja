import React, { useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { hasRole } from "@/lib/roles";

interface InspectionComment {
  id: string;
  author_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

interface InspectionCommentsProps {
  inspectionId: string;
  orderId: string;
  className?: string;
}

const InspectionComments: React.FC<InspectionCommentsProps> = ({
  inspectionId,
  orderId,
  className,
}) => {
  const [comments, setComments] = useState<InspectionComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { user, userProfile } = useAuth();

  const isAdmin = hasRole(userProfile, "admin");
  const canComment =
    isAdmin ||
    hasRole(userProfile, "cs_agent") ||
    hasRole(userProfile, "mechanic") ||
    hasRole(userProfile, "sales") ||
    hasRole(userProfile, "route_planner");

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("inspection_comments")
        .select("id, author_id, author_name, comment, created_at")
        .eq("inspection_id", inspectionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching inspection comments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!inspectionId) return;
    setLoading(true);
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId]);

  const handleSubmit = async () => {
    const text = newComment.trim();
    if (!text || !user?.id) return;
    try {
      setSubmitting(true);
      const authorName =
        (userProfile as any)?.name ||
        (userProfile as any)?.email ||
        user.email ||
        "Staff";
      const { error } = await supabase.from("inspection_comments").insert({
        inspection_id: inspectionId,
        order_id: orderId,
        author_id: user.id,
        author_name: authorName,
        comment: text,
      });
      if (error) throw error;
      setNewComment("");
      setShowForm(false);
      await fetchComments();
      toast.success("Note added");
    } catch (error: any) {
      console.error("Error adding inspection comment:", error);
      toast.error(error?.message || "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("inspection_comments")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== id));
      toast.success("Note deleted");
    } catch (error: any) {
      console.error("Error deleting inspection comment:", error);
      toast.error(error?.message || "Failed to delete note");
    }
  };

  if (!canComment) return null;

  return (
    <div className={`rounded-md border bg-muted/30 p-3 ${className || ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Notes
          {comments.length > 0 && (
            <span className="text-muted-foreground">({comments.length})</span>
          )}
        </span>
        {!showForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add note
          </Button>
        )}
      </div>

      {showForm && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="e.g. Customer also wants a quote for pedals"
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !newComment.trim()}>
              {submitting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Save note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setNewComment("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading notes...</p>
      ) : comments.length === 0 ? (
        !showForm && (
          <p className="mt-2 text-xs text-muted-foreground">No notes yet.</p>
        )
      ) : (
        <ul className="mt-3 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border bg-background p-2">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm">{c.comment}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.author_name} • {format(new Date(c.created_at), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
                {(isAdmin || c.author_id === user?.id) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InspectionComments;
