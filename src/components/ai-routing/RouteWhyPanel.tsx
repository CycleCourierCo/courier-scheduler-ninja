import React from "react";
import { Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";

interface RouteWhyPanelProps {
  archetypeLabel?: string;
  similarityScore?: number;
  compactnessScore?: number;
}

const RouteWhyPanel: React.FC<RouteWhyPanelProps> = ({
  archetypeLabel,
  similarityScore,
  compactnessScore,
}) => {
  const [open, setOpen] = React.useState(false);

  if (!archetypeLabel && similarityScore === undefined) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Info className="h-3 w-3" />
        <span>Why this route?</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 p-3 rounded-lg bg-muted/30 border border-border/30 text-xs">
        {archetypeLabel && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Matched archetype:</span>
            <span className="font-medium">{archetypeLabel}</span>
          </div>
        )}
        {similarityScore !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Archetype similarity:</span>
              <span className="font-medium">{Math.round(similarityScore * 100)}%</span>
            </div>
            <Progress value={similarityScore * 100} className="h-1.5" />
          </div>
        )}
        {compactnessScore !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Route compactness:</span>
              <span className="font-medium">{Math.round(compactnessScore * 100)}%</span>
            </div>
            <Progress value={compactnessScore * 100} className="h-1.5" />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default RouteWhyPanel;
