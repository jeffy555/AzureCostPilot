import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Layers } from "lucide-react";
import type { CostData } from "@shared/schema";

interface ResourceTableProps {
  costData?: CostData[];
}

export default function ResourceTable({ costData = [] }: ResourceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // STRICT Azure-only filtering - absolutely no other provider data
  const azureOnlyData = costData.filter(item => {
    // Triple check: only Azure provider data with Azure-specific fields
    return item.provider === "azure" && 
           item.resourceGroup !== undefined && 
           item.serviceName !== undefined;
  });

  // Filter Azure data based on search term
  const filteredData = azureOnlyData.filter(item =>
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

  const getTrendIcon = (trend: number) => {
    if (trend > 0) {
      return <i className="fas fa-arrow-up text-xs mr-1"></i>;
    } else if (trend < 0) {
      return <i className="fas fa-arrow-down text-xs mr-1"></i>;
    }
    return null;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return "text-red-600";
    if (trend < 0) return "text-green-600";
    return "text-muted-foreground";
  };

  const getStatusBadge = (trend: number) => {
    if (Math.abs(trend) > 20) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5"></span>
          Warning
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
        Active
      </Badge>
    );
  };

  return (
    <Card data-testid="resource-table">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Azure Cost Details</CardTitle>
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Search services and resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
              data-testid="input-search"
            />
            <Button variant="secondary" size="sm" data-testid="button-export">
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
                <TableHead className="text-right">Monthly Cost</TableHead>
                <TableHead className="text-right">Daily Average</TableHead>
                <TableHead className="text-right">Trend</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => {
                  const trend = item.metadata ? (item.metadata as any).trend || 0 : 0;
                  
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50" data-testid={`row-resource-${item.id}`}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                            <Layers className="text-primary text-sm h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground" data-testid={`text-resource-name-${item.id}`}>
                              {item.resourceGroup}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.location}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getServiceBadgeColor(item.serviceName || "")}>
                          {item.serviceName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground" data-testid={`text-monthly-cost-${item.id}`}>
                        ₹{item.monthlyCost}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground" data-testid={`text-daily-cost-${item.id}`}>
                        ₹{item.dailyCost}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center ${getTrendColor(trend)}`}>
                          {getTrendIcon(trend)}
                          <span className="text-sm">{trend > 0 ? '+' : ''}{trend.toFixed(1)}%</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(trend)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No cost entries match your search" : "No cost data available"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredData.length > itemsPerPage && (
          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} cost entries
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  if (page > totalPages) return null;
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      data-testid={`button-page-${page}`}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
        
      </CardContent>
    </Card>
  );
}
