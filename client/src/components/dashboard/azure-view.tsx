import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Layers, RefreshCw } from "lucide-react";
import type { CostData, CostSummary } from "@shared/schema";

interface AzureViewProps {
  costData?: CostData[];
  costSummary?: CostSummary;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function AzureView({ costData = [], costSummary, onRefresh, isRefreshing }: AzureViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter for ONLY Azure data
  const azureData = costData.filter(item => 
    item.provider === "azure" && 
    item.resourceGroup !== undefined && 
    item.serviceName !== undefined
  );

  // Apply search filter
  const filteredData = azureData.filter(item =>
    item.resourceGroup?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.serviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate data
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const getServiceBadgeColor = (serviceName: string) => {
    const colors = {
      "App Service": "bg-blue-100 text-blue-800",
      "Storage": "bg-green-100 text-green-800", 
      "SQL Database": "bg-purple-100 text-purple-800",
      "Virtual Machines": "bg-gray-100 text-gray-800",
    };
    return colors[serviceName as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  // Calculate Azure-specific metrics
  const azureTotalCost = azureData.reduce((sum, item) => sum + parseFloat(item.dailyCost || "0"), 0);
  const azureServiceCount = new Set(azureData.map(item => item.serviceName)).size;
  const azureResourceGroups = new Set(azureData.map(item => item.resourceGroup)).size;

  return (
    <div className="space-y-6">
      {/* Azure Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i className="fab fa-microsoft text-blue-600 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Cloud Providers &gt; Azure</div>
            <h1 className="text-2xl font-bold text-foreground">Azure Cost Management</h1>
            <p className="text-muted-foreground">Monitor and analyze your Azure cloud spending</p>
          </div>
        </div>
        <Button 
          onClick={onRefresh} 
          disabled={isRefreshing}
          variant="outline"
          data-testid="button-refresh-azure"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Azure Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">₹{azureTotalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Actual Azure cost</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{(azureTotalCost / 30).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Average daily spending</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{azureServiceCount}</div>
            <p className="text-xs text-muted-foreground">Service types</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resource Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{azureResourceGroups}</div>
            <p className="text-xs text-muted-foreground">Groups managed</p>
          </CardContent>
        </Card>
      </div>

      {/* Azure Cost Table */}
      <Card data-testid="azure-cost-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <i className="fab fa-microsoft text-blue-600"></i>
              <span>Azure Resources & Costs</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Search Azure resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
                data-testid="input-azure-search"
              />
              <Button variant="secondary" size="sm" data-testid="button-export-azure">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-left">Resource Group</TableHead>
                  <TableHead className="text-left">Service</TableHead>
                  <TableHead className="text-left">Location</TableHead>
                  <TableHead className="text-right">Daily Cost</TableHead>
                  <TableHead className="text-right">Monthly Est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((item, index) => (
                    <TableRow key={`${item.id || index}`} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                            <Layers className="text-blue-600 h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{item.resourceGroup}</p>
                            <p className="text-sm text-muted-foreground">Azure Resource</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getServiceBadgeColor(item.serviceName || "")}>
                          {item.serviceName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.location}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        ₹{item.dailyCost}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ₹{item.monthlyCost || (parseFloat(item.dailyCost || "0") * 30).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No Azure resources match your search" : "No Azure cost data available"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} Azure resources
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm">{currentPage} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}