import * as Sentry from "@sentry/react";
import React, { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ParsedOrderRow,
  BulkCreateResult,
  parseOrderCSV,
  downloadCSVTemplate,
  createBulkOrders,
  CSV_TEMPLATE_HEADERS,
} from "@/services/bulkOrderService";

const BulkOrderUpload: React.FC = () => {
  const [parsedRows, setParsedRows] = useState<ParsedOrderRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BulkCreateResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileContent = useCallback((content: string) => {
    const rows = parseOrderCSV(content);
    if (rows.length === 0) {
      toast.error("No data rows found in CSV");
      return;
    }
    setParsedRows(rows);
    setResults([]);
    setProgress(0);

    const errorCount = rows.filter((r) => r.errors.length > 0).length;
    const validCount = rows.length - errorCount;
    toast.success(`Parsed ${rows.length} rows: ${validCount} valid, ${errorCount} with errors`);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      handleFileContent(event.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file?.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      handleFileContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const toggleRow = (rowIndex: number) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, included: !r.included } : r))
    );
  };

  const includedCount = parsedRows.filter((r) => r.included && r.errors.length === 0).length;

  const handleSubmit = async () => {
    if (includedCount === 0) {
      toast.error("No valid rows selected for submission");
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
          const allResults = await createBulkOrders(parsedRows, (result) => {
            completed++;
            setProgress(Math.round((completed / includedCount) * 100));
            setResults((prev) => [...prev, result]);
          });

          const successCount = allResults.filter((r) => r.success).length;
          const failCount = allResults.filter((r) => !r.success).length;

          span.setAttribute("success_count", successCount);
          span.setAttribute("fail_count", failCount);

          if (failCount === 0) {
            toast.success(`All ${successCount} orders created successfully!`);
          } else {
            toast.warning(`${successCount} orders created, ${failCount} failed`);
          }
        } catch (error) {
          Sentry.captureException(error);
          toast.error("Bulk upload failed");
        }
      }
    );

    setIsSubmitting(false);
  };

  const getResultForRow = (rowIndex: number) => results.find((r) => r.rowIndex === rowIndex);

  const hasFieldError = (row: ParsedOrderRow, field: string) =>
    row.errors.some((e) => e.field === field);

  const displayColumns = [
    { key: "sender_name", label: "Sender" },
    { key: "sender_postcode", label: "From" },
    { key: "receiver_name", label: "Receiver" },
    { key: "receiver_postcode", label: "To" },
    { key: "bike_type", label: "Bike Type" },
    { key: "customer_order_number", label: "Order #" },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Bulk Order Upload</h1>
          <p className="text-muted-foreground mt-1">
            Upload a CSV file to create multiple orders at once
          </p>
        </div>

        {/* Upload area */}
        {parsedRows.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload CSV
              </CardTitle>
              <CardDescription>
                Download the template, fill in your orders, then upload the file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={downloadCSVTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV Template
              </Button>

              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground font-medium">
                  Drag & drop your CSV file here
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  or click to browse
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </CardContent>
          </Card>
        )}

        {/* Preview table */}
        {parsedRows.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <Card>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">{parsedRows.length} rows parsed</Badge>
                    <Badge variant="default">{includedCount} ready to submit</Badge>
                    {parsedRows.filter((r) => r.errors.length > 0).length > 0 && (
                      <Badge variant="destructive">
                        {parsedRows.filter((r) => r.errors.length > 0).length} with errors
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setParsedRows([]);
                        setResults([]);
                        setProgress(0);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || includedCount === 0}
                    >
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
                      <span className="font-medium">
                        {results.filter((r) => r.success).length} created
                      </span>
                    </div>
                    {results.filter((r) => !r.success).length > 0 && (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5" />
                        <span className="font-medium">
                          {results.filter((r) => !r.success).length} failed
                        </span>
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
                        <TableHead className="w-10">#</TableHead>
                        {displayColumns.map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.map((row) => {
                        const result = getResultForRow(row.rowIndex);
                        const hasErrors = row.errors.length > 0;

                        return (
                          <TableRow
                            key={row.rowIndex}
                            className={hasErrors ? "bg-destructive/5" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={row.included}
                                onCheckedChange={() => toggleRow(row.rowIndex)}
                                disabled={hasErrors || isSubmitting}
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {row.rowIndex}
                            </TableCell>
                            {displayColumns.map((col) => (
                              <TableCell
                                key={col.key}
                                className={
                                  hasFieldError(row, col.key)
                                    ? "text-destructive font-medium"
                                    : ""
                                }
                              >
                                {row.data[col.key] || (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            ))}
                            <TableCell>
                              {result ? (
                                result.success ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {result.trackingNumber}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <XCircle className="h-4 w-4 text-destructive" />
                                      </TooltipTrigger>
                                      <TooltipContent>{result.error}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              ) : hasErrors ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <ul className="list-disc pl-4">
                                        {row.errors.map((e, i) => (
                                          <li key={i}>{e.message}</li>
                                        ))}
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
