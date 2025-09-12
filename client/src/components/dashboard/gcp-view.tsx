import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type GcpSummaryResponse = {
  currency: string;
  start: string;
  end: string;
  total: number;
  avgDaily: number;
};

type GcpServicesResponse = {
  currency: string;
  start: string;
  end: string;
  total: number;
  services: Array<{ service: string; amount: number }>;
};

export default function GCPView() {
  const [mtdUSD, setMtdUSD] = useState<number | null>(null);
  const [avgDailyUSD, setAvgDailyUSD] = useState<number | null>(null);
  const [serviceRows, setServiceRows] = useState<Array<{ service: string; amount: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/gcp/mtd-summary", { credentials: "include" });
        const json: GcpSummaryResponse = await res.json();
        if (!res.ok) throw new Error((json as any)?.message || "GCP summary error");
        if (!cancelled) {
          setMtdUSD(Number(json.total || 0));
          setAvgDailyUSD(Number(json.avgDaily || 0));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load GCP summary");
      }
    };
    const fetchServices = async () => {
      try {
        const res = await fetch("/api/gcp/mtd-services", { credentials: "include" });
        const json: GcpServicesResponse = await res.json();
        if (!res.ok) throw new Error((json as any)?.message || "GCP services error");
        if (!cancelled) {
          setServiceRows((json.services || []).map(r => ({ service: r.service || "Unknown", amount: Number(r.amount || 0) })));
        }
      } catch (e: any) {
        // ignore to allow partial rendering
      }
    };
    fetchSummary();
    fetchServices();
    return () => { cancelled = true; };
  }, []);

  const filteredServices = serviceRows.filter(r => r.service.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <i className="fab fa-google text-red-600 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Cloud Providers &gt; Google Cloud</div>
            <h1 className="text-2xl font-bold text-foreground">Google Cloud Cost Management</h1>
            <p className="text-muted-foreground">View your Google Cloud month-to-date costs (USD)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month-to-Date (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{mtdUSD !== null ? `$${mtdUSD.toFixed(2)}` : "—"}</div>
            <p className="text-xs text-muted-foreground">BigQuery billing export {error ? `• ${error}` : ""}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Daily Cost (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDailyUSD !== null ? `$${avgDailyUSD.toFixed(2)}` : "—"}</div>
            <p className="text-xs text-muted-foreground">Current month average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Service Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceRows.length}</div>
            <p className="text-xs text-muted-foreground">Unique services with cost</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {serviceRows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceRows.map(r => ({ name: r.service, value: r.amount }))}
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
                    {serviceRows.map((_, idx) => (
                      <Cell key={`gcp-pie-${idx}`} fill={getGcpColor(idx)} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={50} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No service data available</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <i className="fab fa-google text-red-700"></i>
              <span>GCP Services & Costs (MTD)</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-left">Service</TableHead>
                  <TableHead className="text-right">MTD (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((r, idx) => (
                  <TableRow key={`gcp-svc-${idx}`} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">{r.service}</TableCell>
                    <TableCell className="text-right text-foreground">${r.amount.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
                {serviceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No GCP service costs available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getGcpColor(index: number): string {
  const palette = [
    "#EA4335", "#4285F4", "#FBBC05", "#34A853", "#9C27B0",
    "#00ACC1", "#F4511E", "#7CB342", "#5E35B1", "#039BE5"
  ];
  return palette[index % palette.length];
}

