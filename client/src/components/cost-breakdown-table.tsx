import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Server, Database, HardDrive, Network, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResourceCost } from "@shared/schema";

interface CostBreakdownTableProps {
  resources: ResourceCost[];
  isLoading: boolean;
}

export function CostBreakdownTable({ resources, isLoading }: CostBreakdownTableProps) {
  const getResourceIcon = (resourceType: string) => {
    const type = resourceType.toLowerCase();
    if (type.includes('virtual machine') || type.includes('vm')) {
      return <Server className="h-4 w-4 text-chart-1" />;
    }
    if (type.includes('database') || type.includes('sql')) {
      return <Database className="h-4 w-4 text-chart-2" />;
    }
    if (type.includes('storage')) {
      return <HardDrive className="h-4 w-4 text-chart-3" />;
    }
    if (type.includes('network') || type.includes('gateway') || type.includes('vpn')) {
      return <Network className="h-4 w-4 text-chart-5" />;
    }
    return <Server className="h-4 w-4 text-chart-1" />;
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="mr-1 h-3 w-3" />;
      case 'down':
        return <TrendingDown className="mr-1 h-3 w-3" />;
      default:
        return <Minus className="mr-1 h-3 w-3" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'bg-chart-1/10 text-chart-1';
      case 'down':
        return 'bg-green-100 text-green-600';
      default:
        return 'bg-chart-4/10 text-chart-4';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Resource Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-muted rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-6 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle>Resource Cost Breakdown</CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-export-breakdown">
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Resource Name</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Resource Group</th>
                <th className="text-right py-3 px-6 text-sm font-medium text-muted-foreground">Monthly Cost</th>
                <th className="text-right py-3 px-6 text-sm font-medium text-muted-foreground">Trend</th>
                <th className="text-center py-3 px-6 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No cost data available. Submit a query to analyze Azure costs.
                  </td>
                </tr>
              ) : (
                resources.map((resource, index) => (
                  <tr 
                    key={`${resource.resource_name}-${index}`}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                    data-testid={`row-resource-${index}`}
                  >
                    <td className="py-3 px-6">
                      <div className="flex items-center space-x-3">
                        {getResourceIcon(resource.resource_type)}
                        <span className="font-medium text-card-foreground" data-testid={`text-resource-name-${index}`}>
                          {resource.resource_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-sm text-muted-foreground" data-testid={`text-resource-type-${index}`}>
                      {resource.resource_type}
                    </td>
                    <td className="py-3 px-6 text-sm text-muted-foreground" data-testid={`text-resource-group-${index}`}>
                      {resource.resource_group || '—'}
                    </td>
                    <td className="py-3 px-6 text-right font-medium text-card-foreground" data-testid={`text-resource-cost-${index}`}>
                      ${resource.monthly_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-6 text-right">
                      {(() => {
                        const rawPercent = Number(resource.trend_percentage);
                        const trendPercent = Number.isFinite(rawPercent) ? rawPercent : 0;
                        const trendDirection = resource.trend_direction ?? (trendPercent === 0 ? 'stable' : (trendPercent > 0 ? 'up' : 'down'));
                        const sign = trendPercent > 0 ? '+' : '';
                        const percentLabel = trendDirection === 'stable' ? '0.0%' : `${sign}${trendPercent.toFixed(1)}%`;

                        return (
                          <Badge 
                            variant="outline" 
                            className={`inline-flex items-center text-xs ${getTrendColor(trendDirection)}`}
                            data-testid={`badge-trend-${index}`}
                          >
                            {getTrendIcon(trendDirection)}
                            {percentLabel}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        data-testid={`button-view-resource-${index}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
