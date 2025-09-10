import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { CostSummary, CostData, ServicePrincipal } from "@shared/schema";

export function useCostData() {
  const [lastUpdated, setLastUpdated] = useState<string>();
  const queryClient = useQueryClient();

  // Fetch cost summary
  const { 
    data: costSummary, 
    isLoading: isLoadingSummary,
    error: summaryError 
  } = useQuery<CostSummary>({
    queryKey: ["/api/cost-summary"],
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch cost data
  const { 
    data: costData = [], 
    isLoading: isLoadingCostData,
    error: costDataError 
  } = useQuery<CostData[]>({
    queryKey: ["/api/cost-data"],
    staleTime: 0,
  });

  // Fetch service principals
  const { 
    data: servicePrincipals = [], 
    isLoading: isLoadingSPNs,
    error: spnError 
  } = useQuery<ServicePrincipal[]>({
    queryKey: ["/api/service-principals"],
    staleTime: 0,
  });

  // Refresh data mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/refresh-cost-data");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/cost-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-principals"] });
      setLastUpdated(formatLastUpdated(new Date()));
    },
  });

  // Update last updated time when cost summary changes
  useEffect(() => {
    if (costSummary?.lastUpdated) {
      setLastUpdated(formatLastUpdated(new Date(costSummary.lastUpdated)));
    }
  }, [costSummary]);

  // Auto-refresh on mount
  useEffect(() => {
    refreshMutation.mutate();
  }, []);

  const isLoading = isLoadingSummary || isLoadingCostData || isLoadingSPNs || refreshMutation.isPending;
  const error = summaryError || costDataError || spnError;

  return {
    costSummary,
    costData,
    servicePrincipals,
    isLoading,
    error,
    refreshData: () => refreshMutation.mutate(),
    lastUpdated,
  };
}

function formatLastUpdated(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes === 0) {
    return "Just now";
  } else if (diffMinutes === 1) {
    return "1 minute ago";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else {
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) {
      return "1 hour ago";
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
