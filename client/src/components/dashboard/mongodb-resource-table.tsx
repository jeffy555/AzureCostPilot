import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Database } from "lucide-react";
import type { CostData } from "@shared/schema";

interface MongoDBResourceTableProps {
  costData?: CostData[];
}

export default function MongoDBResourceTable({ costData = [] }: MongoDBResourceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // STRICT MongoDB-only filtering - absolutely no other provider data  
  const mongoOnlyData = costData.filter(item => {
    // Triple check: only MongoDB provider data with MongoDB-specific fields
    return item.provider === "mongodb" && 
           (item.clusterName !== undefined || item.serviceType !== undefined);
  });

  // Filter MongoDB data based on search term
  const filteredData = mongoOnlyData.filter(item =>
    item.clusterName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.serviceType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.databaseName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate data
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const getServiceBadgeColor = (serviceType: string) => {
    const colors = {
      "Atlas Cluster": "bg-green-100 text-green-800",
      "Atlas Backup": "bg-blue-100 text-blue-800",
      "Data Transfer": "bg-purple-100 text-purple-800",
      "Atlas Search": "bg-orange-100 text-orange-800",
      "Atlas Charts": "bg-pink-100 text-pink-800",
      "Atlas Serverless": "bg-indigo-100 text-indigo-800",
    };
    return colors[serviceType as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getRegionBadge = (region: string) => {
    const regionColors = {
      "AWS": "bg-yellow-100 text-yellow-800",
      "GCP": "bg-red-100 text-red-800", 
      "Azure": "bg-blue-100 text-blue-800",
    };
    
    for (const [provider, color] of Object.entries(regionColors)) {
      if (region?.toLowerCase().includes(provider.toLowerCase())) {
        return (
          <Badge className={color}>
            {provider}
          </Badge>
        );
      }
    }
    
    return (
      <Badge className="bg-gray-100 text-gray-800">
        {region}
      </Badge>
    );
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="border-b border-border bg-muted/30">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">MongoDB Atlas Resources</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Monitor your MongoDB Atlas clusters, databases, and service costs
            </CardDescription>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clusters, services, regions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 w-64"
                data-testid="input-mongodb-search"
              />
            </div>
            <Button variant="secondary" size="sm" data-testid="button-export-mongodb">
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
                <TableHead className="text-left">Cluster</TableHead>
                <TableHead className="text-left">Service Type</TableHead>
                <TableHead className="text-left">Region</TableHead>
                <TableHead className="text-right">Daily Cost</TableHead>
                <TableHead className="text-right">Monthly Estimated</TableHead>
                <TableHead className="text-center">Database</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/50" data-testid={`row-mongodb-resource-${item.id}`}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                          <Database className="text-green-600 text-sm h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground" data-testid={`text-cluster-name-${item.id}`}>
                            {item.clusterName || "Unknown Cluster"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(item.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getServiceBadgeColor(item.serviceType || "")}>
                        {item.serviceType || "Atlas Service"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getRegionBadge(item.region || "Unknown")}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground" data-testid={`text-mongodb-daily-cost-${item.id}`}>
                      ₹{item.dailyCost}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground" data-testid={`text-mongodb-monthly-cost-${item.id}`}>
                      ₹{item.monthlyCost || (parseFloat(item.dailyCost || "0") * 30).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.databaseName ? (
                        <Badge variant="outline">
                          {item.databaseName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No MongoDB Atlas resources match your search" : "No MongoDB Atlas cost data available"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredData.length > itemsPerPage && (
          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="text-mongodb-pagination-info">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} MongoDB Atlas resources
              </p>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-mongodb-previous-page"
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
                      data-testid={`button-mongodb-page-${page}`}
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
                  data-testid="button-mongodb-next-page"
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