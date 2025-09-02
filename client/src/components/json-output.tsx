import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CostAnalysisResponse } from "@shared/schema";

interface JsonOutputProps {
  data: CostAnalysisResponse | null;
  isLoading: boolean;
}

export function JsonOutput({ data, isLoading }: JsonOutputProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyJson = async () => {
    if (!data) return;
    
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast({
        title: "JSON Copied",
        description: "Cost analysis data copied to clipboard",
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy JSON to clipboard",
      });
    }
  };

  const getDisplayJson = () => {
    if (!data) return "// No data available. Submit a query to see structured JSON output.";
    return JSON.stringify(data, null, 2);
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle>Structured JSON Output</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCopyJson}
            disabled={!data || isLoading}
            data-testid="button-copy-json"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-4 w-4" />
                Copy JSON
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="animate-pulse">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-4 bg-muted-foreground/20 rounded w-full"></div>
              ))}
            </div>
          </div>
        ) : (
          <pre 
            className="bg-muted rounded-lg p-4 text-xs text-muted-foreground overflow-x-auto font-mono max-h-96 overflow-y-auto"
            data-testid="text-json-output"
          >
            {getDisplayJson()}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
