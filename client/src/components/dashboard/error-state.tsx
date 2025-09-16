import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
}

export default function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <Card className="border-destructive/20" data-testid="error-state">
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="text-destructive h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground" data-testid="text-error-title">
              Failed to Load Cost Data
            </h3>
            <p className="text-sm text-muted-foreground">
              Unable to fetch cost information from Azure
            </p>
          </div>
        </div>
        
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-4 mb-4">
          <p className="text-sm text-destructive mb-2">Error Details:</p>
          <p className="text-sm font-mono text-muted-foreground" data-testid="text-error-message">
            {error.message || "An unexpected error occurred"}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button onClick={onRetry} data-testid="button-retry">
            Retry
          </Button>
          <Button variant="outline" data-testid="button-check-settings">
            Check SPN Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
