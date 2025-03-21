
import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Column {
  id: string;
  label: string;
}

interface TableColumnSettingsProps {
  columns: Column[];
  visibleColumns: string[];
  onChange: (columns: string[]) => void;
}

const TableColumnSettings: React.FC<TableColumnSettingsProps> = ({
  columns,
  visibleColumns,
  onChange,
}) => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(visibleColumns);
  const { user } = useAuth();

  const toggleColumn = (columnId: string) => {
    setSelectedColumns((current) => {
      const newSelection = current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId];
      
      // Update parent component
      onChange(newSelection);
      
      // Save to user profile if user is logged in
      if (user) {
        saveColumnPreferences(newSelection);
      }
      
      return newSelection;
    });
  };

  const saveColumnPreferences = async (columns: string[]) => {
    if (!user) return;

    try {
      // Using the raw update approach to handle table_preferences
      const { error } = await supabase
        .from('profiles')
        .update({ 
          table_preferences: { 
            orders: { visibleColumns: columns } 
          } 
        } as any) // Use type assertion to bypass TypeScript check
        .eq('id', user.id);

      if (error) {
        console.error("Error saving column preferences:", error);
      }
    } catch (error) {
      console.error("Error saving column preferences:", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Settings className="h-4 w-4 mr-1" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Toggle Columns</h4>
          <div className="border-t pt-2">
            {columns.map((column) => (
              <div key={column.id} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={`column-${column.id}`}
                  checked={selectedColumns.includes(column.id)}
                  onCheckedChange={() => toggleColumn(column.id)}
                />
                <label
                  htmlFor={`column-${column.id}`}
                  className="text-sm cursor-pointer"
                >
                  {column.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TableColumnSettings;
