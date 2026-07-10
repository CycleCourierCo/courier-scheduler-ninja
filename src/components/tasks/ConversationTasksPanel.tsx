import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, CheckSquare } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import TaskDialog from "./TaskDialog";
import TaskDetailDrawer from "./TaskDetailDrawer";
import TaskStatusBadge from "./TaskStatusBadge";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  conversationId: string;
  linkedOrderId?: string | null;
  suggestedTitle?: string;
  suggestedDescription?: string;
}

const ConversationTasksPanel: React.FC<Props> = ({
  conversationId, linkedOrderId = null, suggestedTitle = '', suggestedDescription = '',
}) => {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: tasks = [] } = useTasks({
    linkedConversationId: conversationId, status: 'all', userId: user?.id,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
          <CheckSquare className="h-3 w-3" /> Tasks
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> New
        </Button>
      </div>
      {tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground">No tasks for this conversation.</div>
      ) : (
        <div className="space-y-1">
          {tasks.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="w-full text-left text-xs border rounded p-2 hover:bg-accent flex items-center justify-between gap-2"
            >
              <span className="truncate flex-1">{t.title}</span>
              <TaskStatusBadge status={t.status} />
            </button>
          ))}
        </div>
      )}
      <TaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultConversationId={conversationId}
        defaultOrderId={linkedOrderId}
        defaultTitle={suggestedTitle}
        defaultDescription={suggestedDescription}
      />
      <TaskDetailDrawer taskId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
};

export default ConversationTasksPanel;
