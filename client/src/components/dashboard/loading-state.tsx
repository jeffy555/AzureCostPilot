import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingState() {
  return (
    <div className="space-y-6" data-testid="loading-state">
      {/* Cost Overview Loading */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} data-testid={`skeleton-cost-card-${index}`}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="skeleton-trend-chart">
          <CardContent className="p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="w-full h-64" />
          </CardContent>
        </Card>
        <Card data-testid="skeleton-breakdown-chart">
          <CardContent className="p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="w-full h-64" />
          </CardContent>
        </Card>
      </div>

      {/* Table Loading */}
      <Card data-testid="skeleton-resource-table">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-48" />
              <div className="flex space-x-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
            
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 w-32 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
