import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type UsageResp = { totalUsage: number; estimatedSpendUsd?: number; start?: string; end?: string };
type WorkspaceResp = { totalUsage: number; estimatedSpendUsd?: number; start?: string; end?: string; workspaces?: Array<{ id: string; name?: string; usage: number }>; };

export default function ReplitView() {
  const [today, setToday] = useState<UsageResp | null>(null);
  const [month, setMonth] = useState<UsageResp | null>(null);
  const [ws, setWs] = useState<WorkspaceResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const p = async (url: string) => {
        const res = await fetch(url, { credentials: "include", headers: { "Accept": "application/json" }});
        const text = await res.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!res.ok || json == null) {
          throw new Error(`Failed ${url} (${res.status}) ${text.slice(0,120)}`);
        }
        return json;
      };
      const [j1, j2, j3] = await Promise.all([
        p(`/api/replit/usage/today`),
        p(`/api/replit/usage/month`),
        p(`/api/replit/usage/by-workspace`),
      ]);
      setToday(j1); setMonth(j2); setWs(j3);
    } catch (e: any) {
      setError(e?.message || "Failed to load Replit usage");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const int = (n?: number) => typeof n === 'number' ? n.toLocaleString() : "0";
  const usd = (n?: number) => typeof n === 'number' ? `$${n.toFixed(2)}` : "$0.00";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-terminal text-slate-700 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">SaaS Providers &gt; Replit</div>
            <h1 className="text-2xl font-bold text-foreground">Replit Usage</h1>
            <p className="text-muted-foreground">Daily and Month‑to‑date usage with estimated spend</p>
          </div>
        </div>
        <button className="btn btn-secondary px-3 py-2 rounded-md text-sm" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error:</strong> <span className="ml-1">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Usage</div>
            <div className="text-2xl font-semibold">{int(today?.totalUsage)}</div>
            <div className="text-sm text-muted-foreground mt-2">Estimated Spend</div>
            <div className="text-xl">{usd(today?.estimatedSpendUsd)}</div>
            <div className="text-xs text-muted-foreground mt-1">{today?.start}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Month‑to‑date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Usage</div>
            <div className="text-2xl font-semibold">{int(month?.totalUsage)}</div>
            <div className="text-sm text-muted-foreground mt-2">Estimated Spend</div>
            <div className="text-xl">{usd(month?.estimatedSpendUsd)}</div>
            <div className="text-xs text-muted-foreground mt-1">{month?.start} → {month?.end}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Workspaces (MTD)</CardTitle>
          </CardHeader>
          <CardContent>
            {ws?.workspaces && ws.workspaces.length > 0 ? (
              <ul className="text-sm space-y-1 max-h-64 overflow-auto">
                {ws.workspaces.sort((a,b)=>b.usage-a.usage).slice(0,10).map(w => (
                  <li key={w.id} className="flex justify-between"><span>{w.name || w.id}</span><span className="font-medium">{int(w.usage)}</span></li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">No workspace data.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


