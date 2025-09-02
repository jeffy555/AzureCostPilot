import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Server, PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { CostAnalysisResponse } from "@shared/schema";

interface CostOverviewCardsProps {
  data: CostAnalysisResponse | null;
  isLoading: boolean;
}

export function CostOverviewCards({ data, isLoading }: CostOverviewCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                    <div className="h-8 bg-muted rounded w-32 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-20"></div>
                  </div>
                  <div className="w-12 h-12 bg-muted rounded-lg"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const calculatePotentialSavings = () => {
    if (!data?.recommendations) return 0;
    return data.recommendations.reduce((total, rec) => total + rec.potential_savings, 0);
  };

  const calculateSavingsPercentage = () => {
    const savings = calculatePotentialSavings();
    if (!data?.total_monthly_cost || savings === 0) return 0;
    return ((savings / data.total_monthly_cost) * 100);
  };

  const getMonthlyTrend = () => {
    if (!data?.monthly_trends || data.monthly_trends.length < 2) return { percentage: 0, direction: 'stable' as const };
    
    const current = data.monthly_trends[data.monthly_trends.length - 1];
    const previous = data.monthly_trends[data.monthly_trends.length - 2];
    
    if (current && previous) {
      const percentage = ((current.cost - previous.cost) / previous.cost) * 100;
      return {
        percentage: Math.abs(percentage),
        direction: percentage > 0 ? 'up' as const : percentage < 0 ? 'down' as const : 'stable' as const
      };
    }
    
    return { percentage: 0, direction: 'stable' as const };
  };

  const trend = getMonthlyTrend();
  const potentialSavings = calculatePotentialSavings();
  const savingsPercentage = calculateSavingsPercentage();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Cost Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Monthly Cost</p>
              <p className="text-2xl font-bold text-card-foreground" data-testid="text-total-monthly-cost">
                ${data?.total_monthly_cost?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className="text-xs text-muted-foreground" data-testid="text-total-yearly-cost">
                Yearly: ${data?.total_yearly_cost?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
              <p className={`text-xs flex items-center mt-1 ${
                trend.direction === 'up' ? 'text-chart-1' : 
                trend.direction === 'down' ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                {trend.direction === 'up' && <TrendingUp className="mr-1 h-3 w-3" />}
                {trend.direction === 'down' && <TrendingDown className="mr-1 h-3 w-3" />}
                {trend.percentage > 0 ? (
                  `${trend.direction === 'up' ? '+' : '-'}${trend.percentage.toFixed(1)}% from last month`
                ) : (
                  'No change from last month'
                )}
              </p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Highest Cost Resource */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Top Cost Resource</p>
              <p className="text-lg font-semibold text-card-foreground" data-testid="text-top-resource">
                {data?.highest_cost_resource?.resource_name || 'No data'}
              </p>
              <p className="text-xs text-chart-2" data-testid="text-top-resource-cost">
                ${data?.highest_cost_resource?.monthly_cost?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}/month
              </p>
            </div>
            <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
              <Server className="h-6 w-6 text-chart-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Savings Potential */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Potential Savings</p>
              <p className="text-2xl font-bold text-green-600" data-testid="text-potential-savings">
                ${potentialSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">
                {savingsPercentage.toFixed(1)}% reduction possible
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <PiggyBank className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
