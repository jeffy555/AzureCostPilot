import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type AwsServicesResponse = {
  currency: string;
  start: string;
  end: string;
  days: number;
  total: number;
  services: Array<{ service: string; amount: number }>;
};

export default function AWSView() {
  const [mtdUSD, setMtdUSD] = useState<number | null>(null);
  const [avgDailyUSD, setAvgDailyUSD] = useState<number | null>(null);
  const [serviceCount, setServiceCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [serviceRows, setServiceRows] = useState<Array<{service:string; amount:number}>>([]);
  const [regionRows, setRegionRows] = useState<Array<{region:string; amount:number}>>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchAwsCost = async () => {
      try {
        const svcRes = await fetch('/api/aws/mtd-services', { credentials: 'include' });
        const svcJson: AwsServicesResponse = await svcRes.json();
        if (!svcRes.ok) throw new Error((svcJson as any)?.message || 'AWS error');
        const total = Number(svcJson.total || 0);
        const days = Number(svcJson.days || 0) || 1;
        if (!cancelled) {
          setMtdUSD(total);
          setAvgDailyUSD(total / days);
          setServiceCount((svcJson.services || []).length);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load AWS cost');
      }
    };
    const fetchBreakdowns = async () => {
      try {
        const [svcRes, regRes] = await Promise.all([
          fetch('/api/aws/mtd-services', { credentials: 'include' }),
          fetch('/api/aws/mtd-regions', { credentials: 'include' })
        ]);
        const svcJson = await svcRes.json();
        const regJson = await regRes.json();
        if (!cancelled) {
          setServiceRows((svcJson.services || []).map((r:any) => ({ service: r.service, amount: r.amount })));
          setRegionRows((regJson.regions || []).map((r:any) => ({ region: r.region, amount: r.amount })));
        }
      } catch (_) {}
    };
    fetchAwsCost();
    fetchBreakdowns();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <i className="fab fa-aws text-yellow-700 text-xl"></i>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Cloud Providers &gt; AWS</div>
            <h1 className="text-2xl font-bold text-foreground">AWS Cost Management</h1>
            <p className="text-muted-foreground">View your AWS month-to-date costs (USD)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Month-to-Date (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{mtdUSD !== null ? `$${mtdUSD.toFixed(2)}` : '—'}</div>
            <p className="text-xs text-muted-foreground">AWS Cost Explorer {error ? `• ${error}` : ''}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Daily Cost (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDailyUSD !== null ? `$${avgDailyUSD.toFixed(2)}` : '—'}</div>
            <p className="text-xs text-muted-foreground">Current month average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Service Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceCount}</div>
            <p className="text-xs text-muted-foreground">Unique services with cost</p>
          </CardContent>
        </Card>
      </div>

      {/* AWS Service Breakdown Pie */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Service Breakdown</CardTitle>
          </div>
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
                    label={({ percent }) => percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {serviceRows.map((_, idx) => (
                      <Cell key={`pie-${idx}`} fill={getAwsColor(idx)} />
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

      {/* AWS Resources & Costs (by service) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <i className="fab fa-aws text-yellow-700"></i>
              <span>AWS Services & Costs (MTD)</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Button variant="secondary" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
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
                {serviceRows.filter(r => r.service.toLowerCase().includes(search.toLowerCase())).map((r, idx) => (
                  <TableRow key={`svc-${idx}`} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">{r.service}</TableCell>
                    <TableCell className="text-right text-foreground">${r.amount.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
                {serviceRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No AWS service costs available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* AWS Regions & Costs (MTD) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <i className="fab fa-aws text-yellow-700"></i>
            <span>AWS Regions & Costs (MTD)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-left">Region</TableHead>
                  <TableHead className="text-right">MTD (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regionRows.map((r, idx) => (
                  <TableRow key={`reg-${idx}`} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-foreground">{r.region || 'Unknown'}</TableCell>
                    <TableCell className="text-right text-foreground">${r.amount.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
                {regionRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No AWS region costs available</TableCell>
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

function getAwsColor(index: number): string {
  const palette = [
    "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444",
    "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#6366F1"
  ];
  return palette[index % palette.length];
}



