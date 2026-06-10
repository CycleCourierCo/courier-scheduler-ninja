import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, CheckSquare } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import TaskList from "./TaskList";
import TaskDialog from "./TaskDialog";
import TaskDetailDrawer from "./TaskDetailDrawer";
import { useAuth } from "@/contexts/AuthContext";

const OrderTasksPanel: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: tasks = [], isLoading } = useTasks({ linkedOrderId: orderId, status: 'all', userId: user?.id });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-4 w-4" /> Tasks
        </CardTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New task
        </Button>
      </CardHeader>
      <CardContent>
        <TaskList tasks={tasks} loading={isLoading} onSelect={setSelectedId} />
      </CardContent>
      <TaskDialog open={createOpen} onOpenChange={setCreateOpen} defaultOrderId={orderId} />
      <TaskDetailDrawer taskId={selectedId} onOpenChange={(o) => !o && setSelectedId(null)} />
    </Card>
  );
};

export default OrderTasksPanel;
