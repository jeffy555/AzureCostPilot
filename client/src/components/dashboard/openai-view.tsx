import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Summary type (monthly MTD)
type UsageSummary = {
  totalTokens?: number;
  totalRequests?: number;
  start_date?: string;
  end_date?: string;
};

export default function OpenAIView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/openai/usage/summary`, { 
        credentials: "include",
        headers: { "Accept": "application/json" }
      });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { json = null; }
      if (!res.ok || json == null) {
        throw new Error((json && (json.message || json?.error?.message)) || `Failed to fetch OpenAI usage summary (${res.status}) ${text.slice(0, 120)}`);
      }
      setSummary(json);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch OpenAI usage summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const int = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "0");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-brain text-slate-700 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">SaaS Providers &gt; OpenAI</div>
            <h1 className="text-2xl font-bold text-foreground">OpenAI Usage</h1>
            <p className="text-muted-foreground">Month-to-date usage totals</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error:</strong> <span className="ml-1">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : (
              <div className="text-3xl font-semibold text-foreground">{int(summary?.totalRequests)}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{summary?.start_date && summary?.end_date ? `${summary.start_date} → ${summary.end_date}` : ""}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total tokens</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : (
              <div className="text-3xl font-semibold text-foreground">{int(summary?.totalTokens)}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{summary?.start_date && summary?.end_date ? `${summary.start_date} → ${summary.end_date}` : ""}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


