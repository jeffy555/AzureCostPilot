import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Provider = "azure" | "aws" | "gcp" | "mongodb";

export default function AgentView() {
  const [provider, setProvider] = useState<Provider>("azure");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const onRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/agent/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to generate suggestions");
      setResult(json);
    } catch (e: any) {
      setError(e?.message || "Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-hands-helping text-slate-700 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Overview &gt; Let Me Help</div>
            <h1 className="text-2xl font-bold text-foreground">Cost Optimization Assistant</h1>
            <p className="text-muted-foreground">Select a provider and get optimization suggestions</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="border rounded-md px-3 py-2 bg-background"
            >
              <option value="azure">Azure</option>
              <option value="aws">AWS</option>
              <option value="gcp">Google Cloud</option>
              <option value="mongodb">MongoDB Atlas</option>
            </select>
            <button
              onClick={onRun}
              disabled={loading}
              className={`px-4 py-2 rounded-md text-white ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {loading ? "Generating…" : "Get Suggestions"}
            </button>
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Provider:</span> <span className="font-medium capitalize">{result?.summary?.provider}</span></div>
                <div><span className="text-muted-foreground">MTD (USD):</span> <span className="font-medium">${Number(result?.summary?.mtdTotal || 0).toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Engine:</span> <span className="font-medium">{result?.metadata?.engine || "unknown"}</span></div>
                <div>
                  <div className="text-muted-foreground mb-1">Top services</div>
                  <ul className="space-y-1">
                    {(result?.summary?.topServices || []).map((s: any, idx: number) => (
                      <li key={idx} className="flex justify-between"><span>{s.name}</span><span>${Number(s.amount || 0).toFixed(2)}</span></li>
                    ))}
                    {(!result?.summary?.topServices || result?.summary?.topServices.length === 0) && (
                      <li className="text-muted-foreground">No service breakdown available</li>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(result?.recommendations || []).map((r: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{r.title}</div>
                      <span className={`text-xs px-2 py-1 rounded-full ${r.impact === 'high' ? 'bg-red-100 text-red-700' : r.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{r.impact}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{r.detail}</div>
                    <div className="text-sm mt-2"><span className="font-medium">Action:</span> {r.action}</div>
                  </div>
                ))}
                {(!result?.recommendations || result.recommendations.length === 0) && (
                  <div className="text-muted-foreground">No recommendations returned.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


