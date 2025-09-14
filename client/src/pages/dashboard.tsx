import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/dashboard/header";
import Sidebar from "@/components/dashboard/sidebar";
import CostOverview from "@/components/dashboard/cost-overview";
import CostCharts from "@/components/dashboard/cost-charts";
import ResourceTable from "@/components/dashboard/resource-table";
import MongoDBResourceTable from "@/components/dashboard/mongodb-resource-table";
import AzureView from "@/components/dashboard/azure-view";
import AWSView from "@/components/dashboard/aws-view";
import GCPView from "@/components/dashboard/gcp-view";
import TotalView from "@/components/dashboard/total-view";
import MongoDBView from "@/components/dashboard/mongodb-view";
import AgentView from "@/components/dashboard/agent-view";
import ReplitView from "@/components/dashboard/replit-view";
import LoadingState from "@/components/dashboard/loading-state";
import ErrorState from "@/components/dashboard/error-state";
import { useCostData } from "@/hooks/use-cost-data";

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedProvider, setSelectedProvider] = useState<"all" | "azure" | "mongodb">("azure");
  const [currentView, setCurrentView] = useState<"dashboard" | "azure" | "mongodb" | "aws" | "gcp" | "total" | "agent" | "replit">("azure");
  
  const { 
    costSummary, 
    costData, 
    servicePrincipals, 
    isLoading, 
    error, 
    refreshData,
    lastUpdated 
  } = useCostData();

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          onToggleSidebar={toggleSidebar}
          onRefresh={refreshData}
          lastUpdated={lastUpdated}
        />
        <div className="flex h-screen pt-[73px]">
          <Sidebar 
            collapsed={sidebarCollapsed}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
          <main className="flex-1 overflow-auto p-6">
            <ErrorState error={error} onRetry={refreshData} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onToggleSidebar={toggleSidebar}
        onRefresh={refreshData}
        lastUpdated={lastUpdated}
        isRefreshing={isLoading}
      />
      
      <div className="flex h-screen pt-[73px]">
        <Sidebar 
          collapsed={sidebarCollapsed}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onProviderSelect={setSelectedProvider}
          onViewChange={(view) => setCurrentView(view)}
        />
        
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <LoadingState />
            ) : (
              <>
                {activeSection === "dashboard" && currentView === "dashboard" && (
                  <>
                    <CostOverview summary={costSummary} />
                    <CostCharts summary={costSummary} />
                    
                    {/* Provider Selection Tabs */}
                    <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-xl border">
                      <button
                        onClick={() => {
                          console.log("Switching to: all providers");
                          setSelectedProvider("all");
                        }}
                        className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                          selectedProvider === "all" 
                            ? "bg-blue-500 text-white shadow-lg scale-105" 
                            : "bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:scale-102 border border-gray-200"
                        }`}
                        style={{ cursor: 'pointer' }}
                        data-testid="button-provider-all"
                      >
                        🌐 All Providers
                      </button>
                      <button
                        onClick={() => {
                          console.log("Switching to: azure");
                          setSelectedProvider("azure");
                        }}
                        className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                          selectedProvider === "azure" 
                            ? "bg-blue-500 text-white shadow-lg scale-105" 
                            : "bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:scale-102 border border-gray-200"
                        }`}
                        style={{ cursor: 'pointer' }}
                        data-testid="button-provider-azure"
                      >
                        ☁️ Azure
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("🔥 MONGODB BUTTON CLICKED!");
                          setSelectedProvider("mongodb");
                        }}
                        className={selectedProvider === "mongodb" 
                          ? "px-6 py-3 text-sm font-bold rounded-lg bg-green-600 text-white shadow-xl border-2 border-green-400" 
                          : "px-6 py-3 text-sm font-bold rounded-lg bg-white text-green-700 border-2 border-green-500 hover:bg-green-50"
                        }
                        style={{ 
                          cursor: 'pointer',
                          pointerEvents: 'auto',
                          userSelect: 'none',
                          minWidth: '150px'
                        }}
                        data-testid="button-provider-mongodb"
                      >
                        🍃 MongoDB Atlas
                      </button>
                    </div>

                    {/* Debug Info */}
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      Currently selected: <strong>{selectedProvider}</strong> | 
                      Total cost entries: <strong>{costData?.length || 0}</strong> | 
                      Azure entries: <strong>{costData?.filter(item => item.provider === "azure").length || 0}</strong> | 
                      MongoDB entries: <strong>{costData?.filter(item => item.provider === "mongodb").length || 0}</strong> |
                      Current view: <strong>{currentView}</strong>
                    </div>

                    {/* Provider-specific Tables */}
                    {selectedProvider === "azure" && (
                      <ResourceTable 
                        costData={costData?.filter(item => item.provider === "azure") || []} 
                      />
                    )}
                    
                    {selectedProvider === "mongodb" && (
                      <MongoDBResourceTable 
                        costData={costData?.filter(item => item.provider === "mongodb") || []} 
                      />
                    )}
                    
                    {selectedProvider === "all" && (
                      <>
                        <ResourceTable 
                          costData={costData?.filter(item => item.provider === "azure") || []} 
                        />
                        <MongoDBResourceTable 
                          costData={costData?.filter(item => item.provider === "mongodb") || []} 
                        />
                      </>
                    )}
                  </>
                )}

                {/* Dedicated Azure View */}
                {activeSection === "dashboard" && currentView === "azure" && (
                  <AzureView
                    costData={costData}
                    costSummary={costSummary}
                    onRefresh={refreshData}
                    isRefreshing={isLoading}
                  />
                )}

                {/* Dedicated AWS View (placeholder) */}
                {activeSection === "dashboard" && currentView === "aws" && (
                  <AWSView />
                )}

                {/* Dedicated GCP View */}
                {activeSection === "dashboard" && currentView === "gcp" && (
                  <GCPView />
                )}

                {/* Total View */}
                {activeSection === "dashboard" && currentView === "total" && (
                  <TotalView />
                )}

                {/* OpenAI view removed */}

                {/* Dedicated MongoDB View */}
                {activeSection === "dashboard" && currentView === "mongodb" && (
                  <MongoDBView
                    costData={costData}
                    costSummary={costSummary}
                    onRefresh={refreshData}
                    isRefreshing={isLoading}
                  />
                )}

                {/* Replit View */}
                {activeSection === "dashboard" && currentView === "replit" && (
                  <ReplitView />
                )}

                {/* Agent View */}
                {activeSection === "dashboard" && currentView === "agent" && (
                  <AgentView />
                )}
                
                {/* SPN Management removed */}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
