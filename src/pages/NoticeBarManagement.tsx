import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "b2b_customer", label: "B2B Customer" },
  { value: "b2c_customer", label: "B2C Customer" },
  { value: "driver", label: "Driver" },
  { value: "loader", label: "Loader" },
  { value: "mechanic", label: "Mechanic" },
  { value: "route_planner", label: "Route Planner" },
  { value: "sales", label: "Sales" },
];

interface NoticeBar {
  id: string;
  message: string;
  type: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  restricted_to_roles: string[] | null;
}

const NoticeBarManagement = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<NoticeBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const fetchNotices = async () => {
    const { data, error } = await supabase
      .from("notice_bars")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load notices");
    } else {
      setNotices((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleCreate = async () => {
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    const { error } = await supabase.from("notice_bars").insert({
      message: message.trim(),
      type,
      created_by: user?.id,
      expires_at: expiresAt || null,
      restricted_to_roles: selectedRoles.length > 0 ? selectedRoles : null,
    });
    if (error) {
      toast.error("Failed to create notice");
    } else {
      toast.success("Notice created");
      setMessage("");
      setExpiresAt("");
      setSelectedRoles([]);
      fetchNotices();
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("notice_bars")
      .update({ is_active: !currentActive })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update notice");
    } else {
      fetchNotices();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notice_bars").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete notice");
    } else {
      toast.success("Notice deleted");
      fetchNotices();
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const typeBadgeVariant = (t: string) => {
    switch (t) {
      case "warning": return "secondary" as const;
      case "error": return "destructive" as const;
      case "success": return "default" as const;
      default: return "outline" as const;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Notice Bar Management</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Create New Notice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Input
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter announcement message..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="expires">Expires At (optional)</Label>
                <Input
                  id="expires"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Restrict to Roles (optional)</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Leave all unchecked to show to everyone.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ALL_ROLES.map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedRoles.includes(role.value)}
                      onCheckedChange={() => toggleRole(role.value)}
                    />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create Notice
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Notices</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : notices.length === 0 ? (
              <p className="text-muted-foreground">No notices yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notices.map((notice) => (
                    <TableRow key={notice.id}>
                      <TableCell className="max-w-xs truncate">{notice.message}</TableCell>
                      <TableCell>
                        <Badge variant={typeBadgeVariant(notice.type)}>{notice.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {notice.restricted_to_roles && notice.restricted_to_roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {notice.restricted_to_roles.map((role) => (
                              <Badge key={role} variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">All users</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={notice.is_active}
                          onCheckedChange={() => toggleActive(notice.id, notice.is_active)}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {notice.expires_at
                          ? new Date(notice.expires_at).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(notice.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default NoticeBarManagement;
