import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyCostTrend, ServiceCostBreakdown } from "@shared/schema";

interface CostTrendsProps {
  monthlyTrends: MonthlyCostTrend[];
  serviceBreakdown: ServiceCostBreakdown[];
  isLoading: boolean;
}

export function CostTrends({ monthlyTrends, serviceBreakdown, isLoading }: CostTrendsProps) {
  const getMaxCost = () => {
    if (!monthlyTrends.length) return 0;
    return Math.max(...monthlyTrends.map(trend => trend.cost));
  };

  const formatMonth = (monthStr: string) => {
    try {
      const date = new Date(monthStr + '-01');
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return monthStr;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-muted rounded w-32"></div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="flex-1 mx-4 bg-muted rounded-full h-2"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const maxCost = getMaxCost();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Cost Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyTrends.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No monthly trend data available</p>
          ) : (
            <div className="space-y-3">
              {monthlyTrends.map((trend, index) => (
                <div 
                  key={`${trend.month}-${index}`}
                  className="flex items-center justify-between"
                  data-testid={`trend-month-${index}`}
                >
                  <span className="text-sm text-muted-foreground min-w-0 flex-shrink-0">
                    {formatMonth(trend.month)}
                  </span>
                  <div className="flex-1 mx-4 bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className="cost-trend-bar h-full rounded-full" 
                      style={{ width: `${maxCost > 0 ? (trend.cost / maxCost) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-card-foreground min-w-0 flex-shrink-0">
                    ${trend.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Cost by Service Type</CardTitle>
        </CardHeader>
        <CardContent>
          {serviceBreakdown.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No service breakdown data available</p>
          ) : (
            <div className="space-y-4">
              {serviceBreakdown.map((service, index) => (
                <div 
                  key={`${service.service_type}-${index}`}
                  className="flex items-center justify-between"
                  data-testid={`service-breakdown-${index}`}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: service.color || `hsl(var(--chart-${(index % 5) + 1}))` }}
                    ></div>
                    <span className="text-sm text-card-foreground">{service.service_type}</span>
                  </div>
                  <span className="text-sm font-medium text-card-foreground">
                    ${service.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({service.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
