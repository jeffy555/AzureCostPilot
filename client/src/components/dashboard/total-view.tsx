import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type ProviderTotals = {
  azure: number;
  aws: number;
  mongodb: number;
  gcp: number;
  total: number;
};

export default function TotalView() {
  const [totals, setTotals] = useState<ProviderTotals>({ azure: 0, aws: 0, mongodb: 0, gcp: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [topTools, setTopTools] = useState<Array<{ name: string; amount: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchTotals = async () => {
      try {
        const res = await fetch("/api/total/mtd-usd", { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to load totals");
        if (!cancelled) {
          setTotals({
            azure: Number(json.azure || 0),
            aws: Number(json.aws || 0),
            mongodb: Number(json.mongodb || 0),
            gcp: Number(json.gcp || 0),
            total: Number(json.total || 0),
          });
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load totals");
      }
    };
    const fetchBreakdown = async () => {
      try {
        const res = await fetch("/api/total/mtd-usd", { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to load totals");
        const providerPairs = [
          { name: "Azure", amount: Number(json.azure || 0) },
          { name: "AWS", amount: Number(json.aws || 0) },
          { name: "MongoDB", amount: Number(json.mongodb || 0) },
          { name: "GCP", amount: Number(json.gcp || 0) },
        ];
        providerPairs.sort((a, b) => b.amount - a.amount);
        setTopTools(providerPairs);
      } catch (_) {}
    };
    fetchTotals();
    fetchBreakdown();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-wallet text-slate-700 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Overview &gt; Total</div>
            <h1 className="text-2xl font-bold text-foreground">Total Cloud Spend (USD)</h1>
            <p className="text-muted-foreground">Sum of Azure + AWS + MongoDB + GCP (Month-to-Date)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total MTD (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">${totals.total.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{error ? `Error: ${error}` : "Azure + AWS + MongoDB + GCP"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Highest Cost Tools Pie */}
      <Card>
        <CardHeader>
          <CardTitle>Highest Cost Tools (MTD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {topTools.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topTools.map(r => ({ name: r.name, value: r.amount }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={25}
                    dataKey="value"
                    label={({ percent }) => (percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : "")}
                    labelLine={false}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {topTools.map((_, idx) => (
                      <Cell key={`total-pie-${idx}`} fill={getTotalColor(idx)} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={50} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No data available</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Provider breakdown table removed as requested */}
    </div>
  );
}

function getTotalColor(index: number): string {
  const palette = [
    "#2563EB", "#059669", "#F59E0B", "#7C3AED", "#EF4444",
    "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#6366F1"
  ];
  return palette[index % palette.length];
}


