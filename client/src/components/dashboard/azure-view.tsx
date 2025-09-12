import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Layers, RefreshCw } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
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

  // Aggregate by unique resource (resourceGroup + serviceName). Sum daily costs across days
  type AggRow = {
    resourceGroup: string;
    serviceName: string;
    locationLabel: string;
    monthlyTotal: number; // sum of daily costs across the period
    daysCount: number;
  };
  const keyToAgg: Record<string, AggRow> = {};
  const dateSeenByKey: Record<string, Set<string>> = {};
  for (const item of azureData) {
    const rg = item.resourceGroup || "Unknown";
    const svc = item.serviceName || "Unknown";
    const loc = item.location || "Unknown";
    const key = `${rg}||${svc}`;
    if (!keyToAgg[key]) {
      keyToAgg[key] = { resourceGroup: rg, serviceName: svc, locationLabel: loc, monthlyTotal: 0, daysCount: 0 };
      dateSeenByKey[key] = new Set<string>();
    }
    // track multiple locations
    if (keyToAgg[key].locationLabel !== loc) {
      keyToAgg[key].locationLabel = "Multiple";
    }
    const cost = parseFloat(item.dailyCost || "0");
    keyToAgg[key].monthlyTotal += isFinite(cost) ? cost : 0;
    // derive a day key from item.date
    const dayKey = new Date(item.date as unknown as string).toISOString().slice(0,10);
    dateSeenByKey[key].add(dayKey);
  }
  for (const k of Object.keys(keyToAgg)) {
    keyToAgg[k].daysCount = dateSeenByKey[k].size || 1;
  }

  const aggregatedRows: AggRow[] = Object.values(keyToAgg);

  // Apply search filter on aggregated rows
  const filteredData = aggregatedRows.filter(row =>
    row.resourceGroup.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.locationLabel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate aggregated data
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

  // Service breakdown (sum of daily cost by service for current dataset)
  const serviceTotals: Record<string, number> = {};
  for (const item of azureData) {
    const key = item.serviceName || "Other";
    serviceTotals[key] = (serviceTotals[key] || 0) + parseFloat(item.dailyCost || "0");
  }
  const serviceData = Object.entries(serviceTotals)
    .sort((a,b) => b[1]-a[1])
    .map(([name, value]) => ({ name, value, color: getServiceColor(name) }));

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
            <div className="text-2xl font-bold text-blue-600">${azureTotalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Actual Azure cost (USD)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${(azureTotalCost / 30).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Average daily spending (USD)</p>
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

      {/* Azure Service Breakdown Pie */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Service Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={25}
                    dataKey="value"
                    label={({ percent }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={50} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No service data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                  <TableHead className="text-right">Avg Daily Cost</TableHead>
                  <TableHead className="text-right">Monthly Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((row, index) => (
                    <TableRow key={`${row.resourceGroup}-${row.serviceName}-${index}`} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                            <Layers className="text-blue-600 h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{row.resourceGroup}</p>
                            <p className="text-sm text-muted-foreground">Azure Resource</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getServiceBadgeColor(row.serviceName || "")}>
                          {row.serviceName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.locationLabel}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        ${ (row.monthlyTotal / Math.max(1, row.daysCount)).toFixed(2) }
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${ row.monthlyTotal.toFixed(2) }
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

function getServiceColor(serviceName: string): string {
  const colors = {
    "Azure App Service": "#3B82F6",
    "Storage": "#10B981",
    "Log Analytics": "#F59E0B",
    "SQL Database": "#8B5CF6",
    "Virtual Machines": "#EF4444",
    "Bandwidth": "#06B6D4",
    "Container Registry": "#EC4899",
    "Key Vault": "#84CC16",
    "App Service": "#3B82F6",
    "Other": "#6B7280"
  } as Record<string, string>;
  return colors[serviceName] || colors["Other"];
}