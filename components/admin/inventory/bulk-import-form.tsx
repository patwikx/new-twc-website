"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { importStockItems, bulkUpdatePrices, type ImportRowError } from "@/lib/bulk/import";
import {
  generateStockItemTemplate,
  generatePriceUpdateTemplate,
} from "@/lib/bulk/templates";
import { type TemplateSpec } from "@/lib/bulk/template-utils";

interface BulkImportFormProps {
  propertyId: string;
  propertyName: string;
}

type ImportType = "stockItems" | "priceUpdate";

interface ValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  errors: ImportRowError[];
  rowCount: number;
}

export function BulkImportForm({ propertyId, propertyName }: BulkImportFormProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [importType, setImportType] = React.useState<ImportType>("stockItems");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileContent, setFileContent] = React.useState<string>("");
  const [validation, setValidation] = React.useState<ValidationState>({
    isValidating: false,
    isValid: null,
    errors: [],
    rowCount: 0,
  });
  const [isImporting, setIsImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [templateSpec, setTemplateSpec] = React.useState<TemplateSpec | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = React.useState(false);

  // Reset state when import type changes
  React.useEffect(() => {
    setSelectedFile(null);
    setFileContent("");
    setValidation({
      isValidating: false,
      isValid: null,
      errors: [],
      rowCount: 0,
    });
    setTemplateSpec(null);
  }, [importType]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setSelectedFile(file);
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
      
      // Count rows (excluding header and comments)
      const lines = content.split(/\r?\n/).filter(
        (line) => line.trim() && !line.startsWith("#")
      );
      const rowCount = Math.max(0, lines.length - 1); // Subtract header row
      
      setValidation({
        isValidating: false,
        isValid: null,
        errors: [],
        rowCount,
      });
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      let result;
      if (importType === "stockItems") {
        result = await generateStockItemTemplate();
      } else {
        result = await generatePriceUpdateTemplate(propertyId);
      }

      if (!result.success) {
        toast.error(result.error || "Failed to generate template");
        return;
      }

      setTemplateSpec(result.spec);

      // Create and download the file
      const blob = new Blob([result.csvContent], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Template downloaded successfully");
    } catch (error) {
      console.error("Download template error:", error);
      toast.error("Failed to download template");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleImport = async () => {
    if (!fileContent) {
      toast.error("Please select a file first");
      return;
    }

    setShowConfirmDialog(false);
    setIsImporting(true);
    setImportProgress(10);

    try {
      setImportProgress(30);
      
      let result;
      if (importType === "stockItems") {
        result = await importStockItems(propertyId, fileContent);
      } else {
        result = await bulkUpdatePrices(propertyId, fileContent);
      }

      setImportProgress(90);

      if (result.success) {
        setImportProgress(100);
        toast.success(result.message);
        
        // Reset form
        setSelectedFile(null);
        setFileContent("");
        setValidation({
          isValidating: false,
          isValid: null,
          errors: [],
          rowCount: 0,
        });
        
        // Refresh the page data
        router.refresh();
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          errors: result.errors,
          rowCount: validation.rowCount,
        });
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("An unexpected error occurred during import");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileContent("");
    setValidation({
      isValidating: false,
      isValid: null,
      errors: [],
      rowCount: 0,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getImportTypeLabel = () => {
    switch (importType) {
      case "stockItems":
        return "Stock Items";
      case "priceUpdate":
        return "Price Update";
      default:
        return "Items";
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Type Selection */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Select Import Type</CardTitle>
          <CardDescription>
            Choose what type of data you want to import
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
            <TabsList className="grid w-full grid-cols-2 bg-neutral-800">
              <TabsTrigger value="stockItems" className="data-[state=active]:bg-orange-600">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Stock Items
              </TabsTrigger>
              <TabsTrigger value="priceUpdate" className="data-[state=active]:bg-orange-600">
                <FileText className="h-4 w-4 mr-2" />
                Price Update
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="stockItems" className="mt-4">
              <div className="text-sm text-muted-foreground">
                Import new stock items into your inventory. Required fields: name, category, unit.
                Optional fields: SKU, consignment flag, supplier.
              </div>
            </TabsContent>
            
            <TabsContent value="priceUpdate" className="mt-4">
              <div className="text-sm text-muted-foreground">
                Bulk update prices/costs for existing stock items. Required fields: item code, new price.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Template Download */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Template
          </CardTitle>
          <CardDescription>
            Download a CSV template with the correct format and field specifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate}
              variant="outline"
              className="bg-neutral-800 border-white/10 hover:bg-neutral-700"
            >
              {isDownloadingTemplate ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download {getImportTypeLabel()} Template
            </Button>
            
            {templateSpec && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                Template includes field descriptions and valid values
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="bg-neutral-900/50 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload CSV File
          </CardTitle>
          <CardDescription>
            Select a CSV file to import into {propertyName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
            >
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                Click to select a CSV file
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 5MB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Info */}
              <div className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB • {validation.rowCount} data row(s)
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  className="text-muted-foreground hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Validation Errors */}
              {validation.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {validation.errors.length} validation error(s) found
                    </span>
                  </div>
                  <div className="max-h-60 overflow-auto rounded-lg border border-red-500/30 bg-red-500/10">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-red-500/30">
                          <TableHead className="text-red-400 w-20">Row</TableHead>
                          <TableHead className="text-red-400 w-32">Field</TableHead>
                          <TableHead className="text-red-400">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validation.errors.slice(0, 20).map((error, idx) => (
                          <TableRow key={idx} className="border-red-500/30">
                            <TableCell className="text-red-300">{error.row}</TableCell>
                            <TableCell className="text-red-300">{error.field}</TableCell>
                            <TableCell className="text-red-300">
                              {error.message}
                              {error.value && (
                                <span className="text-red-400/70 ml-1">
                                  (value: &quot;{error.value}&quot;)
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {validation.errors.length > 20 && (
                      <div className="p-2 text-center text-sm text-red-400">
                        ... and {validation.errors.length - 20} more errors
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              {/* Import Button */}
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  {validation.isValid === true && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready to import
                    </Badge>
                  )}
                  {validation.isValid === false && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Fix errors before importing
                    </Badge>
                  )}
                </div>
                
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isImporting || validation.rowCount === 0}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import {validation.rowCount} {getImportTypeLabel()}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="bg-neutral-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to import {validation.rowCount} {getImportTypeLabel().toLowerCase()} 
              into {propertyName}. This action will validate all data before importing.
              {importType === "stockItems" && (
                <span className="block mt-2 text-yellow-400">
                  Note: If any validation errors are found, the entire import will be rejected 
                  and no records will be created.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-neutral-800 border-white/10 hover:bg-neutral-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Proceed with Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
