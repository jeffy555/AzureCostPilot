import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, TrendingUp, Lightbulb, Download } from "lucide-react";

interface QuerySidebarProps {
  onSubmitSubscription: (subscriptionName: string) => void;
  isLoading: boolean;
  currentSubscription?: string;
}

export function QuerySidebar({ onSubmitSubscription, isLoading, currentSubscription }: QuerySidebarProps) {
  const [inputValue, setInputValue] = useState("");

  const isGuid = (value: string) => {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed && isGuid(trimmed)) {
      onSubmitSubscription(trimmed);
    }
  };


  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {/* Subscription Input Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-card-foreground">Azure Subscription</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground mb-2">Subscription ID (GUID)</Label>
              <Input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                data-testid="input-subscription-name"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || !isGuid(inputValue.trim())}
              data-testid="button-set-subscription"
            >
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? "Setting..." : "Set Subscription ID"}
            </Button>
          </form>
          
          {currentSubscription && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Current Subscription:</p>
              <p className="text-sm font-medium text-card-foreground" data-testid="text-current-subscription">
                {currentSubscription}
              </p>
            </div>
          )}
        </div>

        {/* Chat Instructions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">How to Use</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>1. Set your subscription name above</p>
            <p>2. Use the chat to ask questions like:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>"Show me the total costs"</li>
              <li>"What are my highest cost resources?"</li>
              <li>"Give me cost optimization recommendations"</li>
              <li>"Analyze costs for resource group 'web-app'"</li>
              <li>"Show cost trends for the last 6 months"</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
