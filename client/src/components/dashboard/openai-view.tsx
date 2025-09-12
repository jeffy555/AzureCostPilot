import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type UsageList = {
  object: string;
  data: any[];
  ft_data?: any[];
  dalle_api_data?: any[];
  whisper_api_data?: any[];
  tts_api_data?: any[];
  assistant_code_interpreter_data?: any[];
  retrieval_storage_data?: any[];
};

export default function OpenAIView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageList | null>(null);

  const fetchUsage = async (params?: { start?: string; end?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const qs = params?.start || params?.end
        ? `?start_date=${encodeURIComponent(params.start || "")}&end_date=${encodeURIComponent(params.end || "")}`
        : "";
      const res = await fetch(`/api/openai/usage${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error?.message || "Failed to fetch OpenAI usage");
      setUsage(json);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch OpenAI usage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

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
            <p className="text-muted-foreground">Shows your account usage for the selected period</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary px-3 py-2 rounded-md text-sm" onClick={() => fetchUsage()}>Today</button>
          <button className="btn btn-secondary px-3 py-2 rounded-md text-sm" onClick={() => {
            const now = new Date();
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0,10);
            const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1)).toISOString().slice(0,10);
            fetchUsage({ start, end });
          }}>This Month</button>
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
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : (
              <div className="text-sm text-foreground space-y-2">
                <div><span className="text-muted-foreground">Object:</span> {usage?.object || "—"}</div>
                <div><span className="text-muted-foreground">Items:</span> {usage?.data?.length ?? 0}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Usage Items</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : usage && usage.data && usage.data.length > 0 ? (
              <div className="max-h-64 overflow-auto text-sm">
                <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-3 rounded-md">{JSON.stringify(usage.data.slice(0, 20), null, 2)}</pre>
              </div>
            ) : (
              <div className="text-muted-foreground">No usage for the selected period.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


