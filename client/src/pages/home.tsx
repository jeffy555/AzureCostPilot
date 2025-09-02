import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QuerySidebar } from "@/components/query-sidebar";
import { ChatInterface } from "@/components/chat-interface";
import { CostOverviewCards } from "@/components/cost-overview-cards";
import { CostBreakdownTable } from "@/components/cost-breakdown-table";
import { CostTrends } from "@/components/cost-trends";
import { OptimizationRecommendations } from "@/components/optimization-recommendations";
import { JsonOutput } from "@/components/json-output";
import { Cloud } from "lucide-react";
import { azureMCPClient } from "@/lib/mcp-client";
import { ChatMessage, CostAnalysisResponse } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<string>("");
  const [azureStatus, setAzureStatus] = useState<{ status: string; azure_configured: boolean } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check Azure MCP server health on component mount
  useEffect(() => {
    azureMCPClient.checkHealth().then(setAzureStatus);
  }, []);

  // Store cost analysis data in state instead of query
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysisResponse | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // Function to handle cost analysis requests
  const performCostAnalysis = async (type: "subscription" | "resource-group" | "resource", value: string, userQuery?: string) => {
    setIsAnalysisLoading(true);
    
    try {
      // For subscription, value is the subscriptionId already set; for RG, pass RG with current subscription
      const response = await azureMCPClient.getCostAnalysis(
        currentSubscription,
        type === 'resource-group' ? value : undefined
      );
      
      if (response.success) {
        setCostAnalysis(response.data || null);
        
        // Add success message to chat
        const successMessage: ChatMessage = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `Cost analysis completed for ${type}: ${value}. I found ${response.data?.cost_breakdown?.length || 0} resources with a total monthly cost of $${response.data?.total_monthly_cost?.toLocaleString() || '0'}. Check the dashboard below for detailed insights.`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev.filter(msg => !msg.isLoading), successMessage]);
      } else {
        throw new Error(response.error || 'Failed to analyze costs');
      }
    } catch (error: any) {
      // Remove loading messages and add error message
      setChatMessages(prev => {
        const withoutLoading = prev.filter(msg => !msg.isLoading);
        return [...withoutLoading, {
          id: Date.now().toString(),
          type: 'assistant',
          content: `I encountered an error analyzing costs: ${error.message}. This might be because the Azure MCP server isn't running. Please check your setup.`,
          timestamp: new Date(),
        }];
      });

      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message,
      });
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const handleSubmitSubscription = (subscriptionName: string) => {
    setCurrentSubscription(subscriptionName);
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      type: 'assistant',
      content: `Great! I've set your subscription to "${subscriptionName}". Now you can ask me questions about your Azure costs. Try asking:\n\n• "Show me the total costs"\n• "What are my highest cost resources?"\n• "Give me optimization recommendations"\n• "Analyze costs for resource group [name]"`,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, message]);
  };

  const handleSendMessage = (message: string) => {
    if (!currentSubscription) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Please set a subscription name first using the form on the left before asking questions.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: 'Analyzing your request...',
      timestamp: new Date(),
      isLoading: true,
    };
    setChatMessages(prev => [...prev, loadingMessage]);

    // Parse the message to determine what analysis to perform
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('resource group') || lowerMessage.includes('rg ')) {
      // Extract resource group name
      const match = message.match(/resource group[s]?[\s"'`]([^"'`\s]+)/i) || message.match(/rg[\s"'`]([^"'`\s]+)/i);
      if (match) {
        performCostAnalysis('resource-group', match[1], message);
      } else {
        setChatMessages(prev => [...prev.filter(msg => !msg.isLoading), {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'I couldn\'t identify the resource group name. Please specify it clearly, like "analyze resource group web-app".',
          timestamp: new Date(),
        }]);
      }
    } else if (lowerMessage.includes('resource ')) {
      // Extract specific resource name
      const match = message.match(/resource[\s"'`]([^"'`\s]+)/i);
      if (match) {
        performCostAnalysis('resource', match[1], message);
      } else {
        setChatMessages(prev => [...prev.filter(msg => !msg.isLoading), {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'I couldn\'t identify the resource name. Please specify it clearly, like "analyze resource vm-web-server".',
          timestamp: new Date(),
        }]);
      }
    } else {
      // Default to subscription-level analysis
      performCostAnalysis('subscription', currentSubscription, message);
    }
  };

  const isLoading = isAnalysisLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <Cloud className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Azure Cost Management Assistant</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {azureStatus?.azure_configured 
                  ? 'Azure credentials configured' 
                  : azureStatus?.status === 'missing_credentials'
                  ? 'Azure credentials missing'
                  : 'Checking Azure connection...'}
              </span>
              <div className={`w-2 h-2 rounded-full ${
                azureStatus?.azure_configured 
                  ? 'bg-green-500 animate-pulse' 
                  : azureStatus?.status === 'missing_credentials'
                  ? 'bg-red-500'
                  : 'bg-yellow-500 animate-pulse'
              }`}></div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <QuerySidebar 
              onSubmitSubscription={handleSubmitSubscription}
              isLoading={isLoading}
              currentSubscription={currentSubscription}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Chat Interface */}
            <ChatInterface
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />

            {/* Cost Overview Dashboard */}
            <CostOverviewCards
              data={costAnalysis}
              isLoading={isAnalysisLoading}
            />

            {/* Cost Breakdown Table */}
            <CostBreakdownTable
              resources={costAnalysis?.cost_breakdown || []}
              isLoading={isAnalysisLoading}
            />

            {/* Cost Trends Visualization */}
            <CostTrends
              monthlyTrends={costAnalysis?.monthly_trends || []}
              serviceBreakdown={costAnalysis?.service_breakdown || []}
              isLoading={isAnalysisLoading}
            />

            {/* Cost Optimization Recommendations */}
            <OptimizationRecommendations
              recommendations={costAnalysis?.recommendations || []}
              isLoading={isAnalysisLoading}
            />

            {/* JSON Output Preview */}
            <JsonOutput
              data={costAnalysis}
              isLoading={isAnalysisLoading}
            />
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border border-border p-8 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">Analyzing Azure Costs</h3>
              <p className="text-sm text-muted-foreground">Connecting to Azure MCP server and fetching cost data...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
