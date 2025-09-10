import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Database, RefreshCw } from "lucide-react";
import type { CostData, CostSummary } from "@shared/schema";

interface MongoDBViewProps {
  costData?: CostData[];
  costSummary?: CostSummary;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function MongoDBView({ costData = [], costSummary, onRefresh, isRefreshing }: MongoDBViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [mtdUSD, setMtdUSD] = useState<number | null>(null);
  const [mtdError, setMtdError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<Array<{name:string; region:string; cloudProvider:string; stateName:string}> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchMtd = async () => {
      try {
        // Step 1: init to get token
        const initResp = await fetch('/api/mongodb/ce-init', { method: 'POST', credentials: 'include' });
        if (!initResp.ok) throw new Error(await initResp.text());
        const initJson = await initResp.json();
        const token: string | undefined = initJson?.token;
        if (!token) throw new Error('No token from CE init');

        // Step 2: poll usage until ready
        let usageAmount = 0;
        for (let i = 0; i < 12; i++) {
          const usageResp = await fetch(`/api/mongodb/ce-usage/${token}`, { credentials: 'include' });
          if (usageResp.ok) {
            const usageJson = await usageResp.json();
            usageAmount = Number(usageJson?.usageAmount) || 0;
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        if (!cancelled) setMtdUSD(usageAmount);
      } catch (e: any) {
        if (!cancelled) setMtdError('Failed to load MTD usage');
      }
    };
    const fetchClusters = async () => {
      try {
        const res = await fetch('/api/mongodb/clusters', { credentials: 'include' });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancelled) setClusters(data.clusters || []);
      } catch (_) {
        if (!cancelled) setClusters([]);
      }
    };
    fetchMtd();
    fetchClusters();
    return () => { cancelled = true; };
  }, []);

  // Filter for ONLY MongoDB data
  const mongoData = costData.filter(item => 
    item.provider === "mongodb" && 
    (item.clusterName !== undefined || item.serviceType !== undefined)
  );

  // Apply search filter
  const filteredData = mongoData.filter(item =>
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
    if (region?.toLowerCase().includes("aws")) {
      return <Badge className="bg-yellow-100 text-yellow-800">AWS</Badge>;
    } else if (region?.toLowerCase().includes("gcp")) {
      return <Badge className="bg-red-100 text-red-800">GCP</Badge>;
    } else if (region?.toLowerCase().includes("azure")) {
      return <Badge className="bg-blue-100 text-blue-800">Azure</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">{region}</Badge>;
  };

  // Calculate MongoDB-specific metrics (USD)
  const mongoMtdCostUSD = mongoData.reduce((sum, item) => {
    const monthly = item.monthlyCost ? parseFloat(item.monthlyCost) : 0;
    const daily = item.dailyCost ? parseFloat(item.dailyCost) : 0;
    return sum + (monthly || (daily * 30));
  }, 0);
  const mongoDailyCostUSD = mongoData.reduce((sum, item) => sum + (item.dailyCost ? parseFloat(item.dailyCost) : 0), 0);
  const mongoServiceCount = new Set(mongoData.map(item => item.serviceType)).size;
  const mongoClusters = new Set(mongoData.map(item => item.clusterName)).size;

  return (
    <div className="space-y-6">
      {/* MongoDB Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-database text-green-600 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">SaaS Providers &gt; MongoDB Atlas</div>
            <h1 className="text-2xl font-bold text-foreground">MongoDB Atlas Cost Management</h1>
            <p className="text-muted-foreground">Monitor and analyze your MongoDB Atlas spending</p>
          </div>
        </div>
        <Button 
          onClick={onRefresh} 
          disabled={isRefreshing}
          variant="outline"
          data-testid="button-refresh-mongodb"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* MongoDB Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month-to-Date (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mtdUSD !== null ? `$${mtdUSD.toFixed(2)}` : '—'}</div>
            <p className="text-xs text-muted-foreground">MongoDB Atlas {mtdError ? `• ${mtdError}` : ''}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clusters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{clusters ? clusters.length : 0}</div>
            <p className="text-xs text-muted-foreground">Active clusters</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{mongoData.length}</div>
            <p className="text-xs text-muted-foreground">Total records</p>
          </CardContent>
        </Card>
      </div>

      {/* MongoDB Cost Table */}
      <Card data-testid="mongodb-cost-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <i className="fas fa-database text-green-600"></i>
              <span>MongoDB Atlas Resources & Costs</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Search MongoDB resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
                data-testid="input-mongodb-search"
              />
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
                  <TableHead className="text-right">Daily Cost (USD)</TableHead>
                  <TableHead className="text-right">Monthly (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((item, index) => (
                    <TableRow key={`${item.id || index}`} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                            <Database className="text-green-600 h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{item.clusterName}</p>
                            <p className="text-sm text-muted-foreground">MongoDB Cluster</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getServiceBadgeColor(item.serviceType || "")}>
                          {item.serviceType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getRegionBadge(item.region || "")}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        {item.dailyCost ? `$${item.dailyCost}` : "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.monthlyCost
                          ? `$${item.monthlyCost}`
                          : `$${(parseFloat(item.dailyCost || "0") * 30).toFixed(2)}`}
                      </TableCell>
                    </TableRow>
                  ))
                ) : clusters && clusters.length > 0 ? (
                  clusters.map((c, idx) => (
                    <TableRow key={`cluster-${idx}`} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                            <Database className="text-green-600 h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{c.name}</p>
                            <p className="text-sm text-muted-foreground">{c.stateName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getServiceBadgeColor("Atlas Cluster")}>
                          Atlas Cluster
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getRegionBadge(c.region || "")}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">-</TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No MongoDB resources match your search" : "No MongoDB Atlas cost data available"}
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
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} MongoDB resources
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