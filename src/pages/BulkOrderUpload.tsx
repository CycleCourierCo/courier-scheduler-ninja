import * as Sentry from "@sentry/react";
import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, AlertTriangle } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  GroupedOrder,
  BulkCreateResult,
  parseFile,
  groupRowsByOrderNumber,
  downloadCSVTemplate,
  createBulkOrders,
  validateProfileForSender,
} from "@/services/bulkOrderService";

const BulkOrderUpload: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrder[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BulkCreateResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileMissing = validateProfileForSender(userProfile);

  const handleFile = useCallback(async (file: File) => {
    const validExtensions = [".csv", ".xlsx", ".xls"];
    if (!validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      toast.error("Please upload a CSV or XLSX file");
      return;
    }

    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast.error("No data rows found in file");
        return;
      }

      const grouped = groupRowsByOrderNumber(rows);
      setGroupedOrders(grouped);
      setResults([]);
      setProgress(0);

      const errorCount = grouped.filter((o) => o.errors.length > 0).length;
      const totalBikes = grouped.reduce((sum, o) => sum + o.bikes.length, 0);
      toast.success(`Parsed ${totalBikes} bikes into ${grouped.length} orders (${errorCount} with errors)`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error("Failed to parse file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const toggleOrder = (orderNumber: string) => {
    setGroupedOrders((prev) =>
      prev.map((o) =>
        (o.orderNumber || `single_${o.sourceRowIndices[0]}`) === orderNumber
          ? { ...o, included: !o.included }
          : o
      )
    );
  };

  const includedCount = groupedOrders.filter((o) => o.included && o.errors.length === 0).length;

  const handleSubmit = async () => {
    if (profileMissing.length > 0) {
      toast.error("Please complete your profile before submitting");
      navigate("/profile");
      return;
    }
    if (includedCount === 0) {
      toast.error("No valid orders selected for submission");
      return;
    }

    setIsSubmitting(true);
    setResults([]);
    setProgress(0);

    let completed = 0;
    await Sentry.startSpan(
      { op: "bulk_upload", name: "Bulk Order Creation" },
      async (span) => {
        span.setAttribute("order_count", includedCount);
        try {
          const allResults = await createBulkOrders(groupedOrders, userProfile, (result) => {
            completed++;
            setProgress(Math.round((completed / includedCount) * 100));
            setResults((prev) => [...prev, result]);
          });

          const successCount = allResults.filter((r) => r.success).length;
          const failCount = allResults.filter((r) => !r.success).length;
          span.setAttribute("success_count", successCount);
          span.setAttribute("fail_count", failCount);

          if (failCount === 0) toast.success(`All ${successCount} orders created successfully!`);
          else toast.warning(`${successCount} orders created, ${failCount} failed`);
        } catch (error) {
          Sentry.captureException(error);
          toast.error("Bulk upload failed");
        }
      }
    );
    setIsSubmitting(false);
  };

  const getResultForOrder = (orderNum: string) =>
    results.find((r) => r.orderNumber === orderNum);

  const getBikeBreakdown = (bikes: GroupedOrder["bikes"]): string[] => {
    const counts = new Map<string, number>();
    for (const b of bikes) {
      const label = [b.brand, b.model].filter(Boolean).join(" ") || b.type;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([label, qty]) =>
      qty > 1 ? `${qty}× ${label}` : label
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Bulk Order Upload</h1>
          <p className="text-muted-foreground mt-1">
            Upload a CSV or XLSX file to create multiple orders at once
          </p>
        </div>

        {profileMissing.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your profile is missing: {profileMissing.join(", ")}. Sender details are auto-filled from your profile.{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/profile")}>
                Complete your profile
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {profileMissing.length === 0 && userProfile && (
          <Alert className="mb-4">
            <AlertDescription>
              Sender (collection) details will be auto-filled from your profile: <strong>{userProfile.name}</strong>, {userProfile.address_line_1}, {userProfile.postal_code}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload area */}
        {groupedOrders.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload File
              </CardTitle>
              <CardDescription>
                Upload your dealer order spreadsheet (.xlsx) or CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={downloadCSVTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>

              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground font-medium">Drag & drop your file here</p>
                <p className="text-muted-foreground text-sm mt-1">Supports .xlsx and .csv files</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </CardContent>
          </Card>
        )}

        {/* Preview table */}
        {groupedOrders.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">{groupedOrders.length} orders</Badge>
                    <Badge variant="default">{includedCount} ready</Badge>
                    <Badge variant="secondary">
                      {groupedOrders.reduce((s, o) => s + o.bikes.length, 0)} bikes total
                    </Badge>
                    {groupedOrders.filter((o) => o.errors.length > 0).length > 0 && (
                      <Badge variant="destructive">
                        {groupedOrders.filter((o) => o.errors.length > 0).length} with errors
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setGroupedOrders([]); setResults([]); setProgress(0); }}>
                      Clear
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || includedCount === 0 || profileMissing.length > 0}>
                      {isSubmitting ? "Creating Orders..." : `Submit ${includedCount} Orders`}
                    </Button>
                  </div>
                </div>

                {isSubmitting && (
                  <div className="mt-4">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-1">
                      {results.length} of {includedCount} processed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results summary */}
            {results.length > 0 && !isSubmitting && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">{results.filter((r) => r.success).length} created</span>
                    </div>
                    {results.filter((r) => !r.success).length > 0 && (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        <span className="font-medium">{results.filter((r) => !r.success).length} failed</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Receiver</TableHead>
                        <TableHead>Postcode</TableHead>
                        <TableHead>Bikes</TableHead>
                        <TableHead>Types</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedOrders.map((order) => {
                        const key = order.orderNumber || `single_${order.sourceRowIndices[0]}`;
                        const result = getResultForOrder(order.orderNumber);
                        const hasErrors = order.errors.length > 0;

                        return (
                          <TableRow key={key} className={hasErrors ? "bg-destructive/5" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={order.included}
                                onCheckedChange={() => toggleOrder(key)}
                                disabled={hasErrors || isSubmitting}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.orderNumber || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>{order.receiverData.receiver_name || "—"}</TableCell>
                            <TableCell>{order.receiverData.receiver_postcode || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{order.bikes.length}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[300px]">
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                {getBikeBreakdown(order.bikes).map((line, i) => (
                                  <div key={i} className="truncate">{line}</div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {result ? (
                                result.success ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger><CheckCircle2 className="h-4 w-4 text-green-600" /></TooltipTrigger>
                                      <TooltipContent>{result.trackingNumber}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger><XCircle className="h-4 w-4 text-destructive" /></TooltipTrigger>
                                      <TooltipContent>{result.error}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              ) : hasErrors ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger><AlertCircle className="h-4 w-4 text-destructive" /></TooltipTrigger>
                                    <TooltipContent>
                                      <ul className="list-disc pl-4">
                                        {order.errors.map((e, i) => <li key={i}>{e.message}</li>)}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-muted-foreground text-xs">Ready</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BulkOrderUpload;
