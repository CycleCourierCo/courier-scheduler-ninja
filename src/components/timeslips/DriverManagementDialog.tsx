import React, { useState } from 'react';
import { Driver } from '@/types/timeslip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Save, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driverService } from '@/services/driverService';
import { toast } from 'sonner';

interface DriverManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const DriverManagementDialog: React.FC<DriverManagementDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Driver>>({});
  const queryClient = useQueryClient();

  const { data: drivers, isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driverService.getAllDrivers(),
    enabled: isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Driver> }) =>
      driverService.updateDriver(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver updated successfully');
      setEditingId(null);
    },
    onError: () => {
      toast.error('Failed to update driver');
    },
  });

  const handleEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setEditForm(driver);
  };

  const handleSave = () => {
    if (editingId && editForm) {
      updateMutation.mutate({ id: editingId, updates: editForm });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Drivers</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-center text-muted-foreground">Loading drivers...</p>
        ) : (
          <div className="space-y-4">
            {drivers?.map((driver) => (
              <Card key={driver.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{driver.name}</span>
                    {editingId === driver.id ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave}>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancel}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleEdit(driver)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  {editingId === driver.id ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`email-${driver.id}`}>Email</Label>
                        <Input
                          id={`email-${driver.id}`}
                          value={editForm.email || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, email: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`phone-${driver.id}`}>Phone</Label>
                        <Input
                          id={`phone-${driver.id}`}
                          value={editForm.phone || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, phone: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`hourly_rate-${driver.id}`}>Hourly Rate (£)</Label>
                        <Input
                          id={`hourly_rate-${driver.id}`}
                          type="number"
                          step="0.01"
                          value={editForm.hourly_rate || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              hourly_rate: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`van_allowance-${driver.id}`}>Van Allowance (£)</Label>
                        <Input
                          id={`van_allowance-${driver.id}`}
                          type="number"
                          step="0.01"
                          value={editForm.van_allowance || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              van_allowance: parseFloat(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`uses_own_van-${driver.id}`}
                          checked={editForm.uses_own_van || false}
                          onCheckedChange={(checked) =>
                            setEditForm({ ...editForm, uses_own_van: checked })
                          }
                        />
                        <Label htmlFor={`uses_own_van-${driver.id}`}>Uses Own Van</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id={`is_active-${driver.id}`}
                          checked={editForm.is_active !== false}
                          onCheckedChange={(checked) =>
                            setEditForm({ ...editForm, is_active: checked })
                          }
                        />
                        <Label htmlFor={`is_active-${driver.id}`}>Active</Label>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Email:</span>{' '}
                        {driver.email || 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>{' '}
                        {driver.phone || 'N/A'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hourly Rate:</span>{' '}
                        £{driver.hourly_rate.toFixed(2)}/h
                      </div>
                      <div>
                        <span className="text-muted-foreground">Van Allowance:</span>{' '}
                        £{driver.van_allowance.toFixed(2)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Uses Own Van:</span>{' '}
                        {driver.uses_own_van ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>{' '}
                        {driver.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DriverManagementDialog;
