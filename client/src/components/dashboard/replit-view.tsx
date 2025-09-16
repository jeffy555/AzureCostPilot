import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type CostSummary = {
  totalSpendUsd: number | null;
  totalCreditsGranted: number | null;
  additionalUsageUsd: number | null;
  period?: { startDate?: string | null; endDate?: string | null };
  capturedAt?: string | null;
};

export default function ReplitView() {
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCost = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/replit/cost`);
      const json = await res.json();
      if (!res.ok || json?.ok !== true) throw new Error(json?.message || "Failed to load Replit cost");
      setCost(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load Replit cost");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCost(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-code text-slate-700 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">SaaS Providers &gt; Replit</div>
            <h1 className="text-2xl font-bold text-foreground">Replit Usage</h1>
            <p className="text-muted-foreground">Costs and credits from cost.json</p>
          </div>
        </div>
        <button
          className="px-3 py-2 rounded-md bg-primary text-white text-sm"
          onClick={fetchCost}
          disabled={loading}
        >{loading ? "Refreshing..." : "Refresh"}</button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {typeof cost?.totalSpendUsd === 'number' ? `$${cost.totalSpendUsd.toFixed(2)}` : "—"}
            </div>
            {/* Date range removed per request */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Credits Granted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {typeof cost?.totalCreditsGranted === 'number' ? `$${cost.totalCreditsGranted.toFixed(2)}` : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Additional Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {typeof cost?.additionalUsageUsd === 'number' ? `$${cost.additionalUsageUsd.toFixed(2)}` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




