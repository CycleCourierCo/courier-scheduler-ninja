import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Key, Copy, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

interface ApiKey {
  id: string;
  user_id: string;
  key_name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    name: string;
    email: string;
    company_name: string;
  };
}

interface Customer {
  id: string;
  name: string;
  email: string;
  company_name: string;
  role: string;
}

export default function ApiKeysPage() {
  const { userProfile } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [keyName, setKeyName] = useState('');
  const [newApiKey, setNewApiKey] = useState<string>('');
  const [showNewKey, setShowNewKey] = useState(false);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchApiKeys();
      fetchCustomers();
    }
  }, [userProfile]);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select(`
          *,
          profiles!api_keys_user_id_fkey (
            name,
            email,
            company_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, company_name, role')
        .in('role', ['b2b_customer', 'b2c_customer'])
        .eq('account_status', 'approved')
        .order('name');

      if (error) throw error;
      
      console.log('Fetched customers:', data); // Debug log
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customers');
    }
  };

  const generateApiKey = async () => {
    if (!selectedCustomer || !keyName.trim()) {
      toast.error('Please select a customer and enter a key name');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('admin_generate_api_key', {
        customer_id: selectedCustomer,
        key_name: keyName.trim()
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setNewApiKey(data[0].api_key);
        setShowNewKey(true);
        toast.success('API key generated successfully');
        fetchApiKeys();
        setSelectedCustomer('');
        setKeyName('');
        setShowGenerateDialog(false);
      }
    } catch (error) {
      console.error('Error generating API key:', error);
      toast.error('Failed to generate API key');
    }
  };

  const revokeApiKey = async (keyId: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_revoke_api_key', {
        key_id: keyId
      });

      if (error) throw error;

      if (data) {
        toast.success('API key revoked successfully');
        fetchApiKeys();
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (userProfile?.role !== 'admin') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Key Management</h1>
            <p className="text-muted-foreground">
              Generate and manage API keys for customer accounts
            </p>
          </div>
          
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Generate API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate New API Key</DialogTitle>
                <DialogDescription>
                  Create a new API key for a customer account. This key will allow them to create orders programmatically.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customer">Customer</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger className="bg-background border border-input">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-input z-50">
                      {customers.length === 0 ? (
                        <SelectItem value="no-customers" disabled>
                          No approved customers found
                        </SelectItem>
                      ) : (
                        customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name || customer.email} 
                            {customer.company_name && ` - ${customer.company_name}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="e.g., Production API, Test Environment"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={generateApiKey}>
                  Generate Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* New API Key Display Dialog */}
        <Dialog open={showNewKey} onOpenChange={setShowNewKey}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>API Key Generated</DialogTitle>
              <DialogDescription>
                Your API key has been generated. Copy it now as it won't be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <code className="text-sm break-all">{newApiKey}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newApiKey)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Store this key securely. You won't be able to see it again.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowNewKey(false)}>
                I've Copied the Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Active API Keys
            </CardTitle>
            <CardDescription>
              Manage API keys for customer accounts. Keys allow programmatic access to create orders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Key Name</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No API keys found. Generate one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{key.profile?.name}</div>
                            <div className="text-sm text-muted-foreground">{key.profile?.email}</div>
                            {key.profile?.company_name && (
                              <div className="text-sm text-muted-foreground">{key.profile.company_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{key.key_name}</TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">{key.key_prefix}...</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant={key.is_active ? 'default' : 'secondary'}>
                            {key.is_active ? 'Active' : 'Revoked'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {key.last_used_at 
                            ? format(new Date(key.last_used_at), 'MMM d, yyyy')
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          {format(new Date(key.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {key.is_active && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to revoke this API key? This action cannot be undone and the customer will lose API access.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => revokeApiKey(key.id)}>
                                    Revoke Key
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}