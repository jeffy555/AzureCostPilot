import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Zap, Trash2, Target, Lightbulb } from "lucide-react";
import { CostRecommendation } from "@shared/schema";

interface OptimizationRecommendationsProps {
  recommendations: CostRecommendation[];
  isLoading: boolean;
}

export function OptimizationRecommendations({ recommendations, isLoading }: OptimizationRecommendationsProps) {
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'reserved_instances':
        return <Clock className="h-5 w-5 text-green-600" />;
      case 'right_sizing':
        return <Zap className="h-5 w-5 text-blue-600" />;
      case 'unused_resources':
        return <Trash2 className="h-5 w-5 text-orange-600" />;
      case 'spot_instances':
        return <Target className="h-5 w-5 text-purple-600" />;
      default:
        return <Lightbulb className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center">
            <Lightbulb className="mr-2 h-5 w-5 text-chart-4" />
            Cost Optimization Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <div className="animate-pulse">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-muted rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-3 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-24"></div>
                    </div>
                  </div>
                </div>
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
        <CardTitle className="flex items-center">
          <Lightbulb className="mr-2 h-5 w-5 text-chart-4" />
          Cost Optimization Recommendations
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {recommendations.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No optimization recommendations available. Submit a cost analysis query to get personalized recommendations.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((recommendation, index) => (
              <div 
                key={`${recommendation.type}-${index}`}
                className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                data-testid={`recommendation-${index}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                    {getRecommendationIcon(recommendation.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-card-foreground" data-testid={`text-recommendation-title-${index}`}>
                        {recommendation.title}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceBadgeColor(recommendation.confidence)}`}>
                        {recommendation.confidence}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3" data-testid={`text-recommendation-description-${index}`}>
                      {recommendation.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-600" data-testid={`text-savings-${index}`}>
                        Save ${recommendation.potential_savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}/month
                      </span>
                      <Button 
                        size="sm" 
                        className="text-xs"
                        data-testid={`button-apply-recommendation-${index}`}
                      >
                        {recommendation.action_required || 'Apply'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
