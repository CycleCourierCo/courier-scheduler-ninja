import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useKbVersions } from "@/hooks/useKnowledge";
import { updateArticle } from "@/services/knowledgeService";
import MarkdownView from "./MarkdownView";

interface Props {
  articleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}

const VersionHistoryDialog = ({ articleId, open, onOpenChange, onRestored }: Props) => {
  const { data: versions = [], isLoading } = useKbVersions(open ? articleId : undefined);

  const restore = async (title: string, body: string, summary: string | null) => {
    try {
      await updateArticle(articleId, { title, body, summary });
      toast.success("Version restored");
      onOpenChange(false);
      onRestored();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not restore that version");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && versions.length === 0 && (
            <p className="text-sm text-muted-foreground">No earlier versions yet.</p>
          )}
          <div className="space-y-4">
            {versions.map((v) => (
              <div key={v.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(v.created_at), "d MMM yyyy HH:mm")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore(v.title, v.body, v.summary)}
                  >
                    Restore
                  </Button>
                </div>
                <div className="mt-2 max-h-40 overflow-hidden opacity-80">
                  <MarkdownView content={v.body.slice(0, 1200)} />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VersionHistoryDialog;
