import React, { useState, useEffect } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface OrderComment {
  id: string;
  admin_id: string;
  admin_name: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface OrderCommentsProps {
  orderId: string;
}

const OrderComments: React.FC<OrderCommentsProps> = ({ orderId }) => {
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { userProfile } = useAuth();

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    fetchComments();
  }, [orderId]);

  const fetchComments = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('order_comments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !isAdmin || !userProfile?.name) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('order_comments')
        .insert({
          order_id: orderId,
          admin_id: userProfile.id,
          admin_name: userProfile.name,
          comment: newComment.trim()
        });

      if (error) throw error;

      setNewComment("");
      toast.success('Comment added successfully');
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('order_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast.success('Comment deleted');
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading comments...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        <div className="space-y-3">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <Button 
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {submitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>

        {/* Comments List */}
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No comments yet. Add the first comment above.
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-muted/50 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.admin_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), 'MMM d, yyyy at h:mm a')}
                    </span>
                  </div>
                  {comment.admin_id === userProfile?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderComments;