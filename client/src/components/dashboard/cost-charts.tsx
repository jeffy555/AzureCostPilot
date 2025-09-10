import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { CostSummary } from "@shared/schema";

interface CostChartsProps {
  summary?: CostSummary;
}

export default function CostCharts({ summary }: CostChartsProps) {
  // Prepare trend data
  const trendData = summary?.trendData ? 
    (summary.trendData as any).labels?.map((label: string, index: number) => ({
      name: label,
      cost: (summary.trendData as any).values?.[index] || 0
    })) : [];

  // Prepare service breakdown data
  const serviceData = summary?.serviceBreakdown ? 
    Object.entries(summary.serviceBreakdown as Record<string, number>).map(([name, value]) => ({
      name,
      value,
      color: getServiceColor(name)
    })) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="cost-charts">
      {/* Cost Trend Chart */}
      <Card data-testid="card-cost-trend">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cost Trend (Last 30 Days)</CardTitle>
            <Select defaultValue="30">
              <SelectTrigger className="w-32" data-testid="select-trend-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No trend data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service Breakdown Chart */}
      <Card data-testid="card-service-breakdown">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Service Breakdown</CardTitle>
            <Button variant="ghost" size="sm" data-testid="button-view-details">
              View Details
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={25}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => percent > 5 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {serviceData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        style={{
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                        }}
                      />
                    ))}
                  </Pie>
                  <Legend 
                    verticalAlign="bottom" 
                    height={50}
                    iconType="circle"
                    wrapperStyle={{
                      fontSize: '12px',
                      color: '#64748B'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No service data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getServiceColor(serviceName: string): string {
  const colors = {
    "Azure App Service": "#3B82F6",     // Bright Blue
    "Storage": "#10B981",               // Emerald Green  
    "Log Analytics": "#F59E0B",         // Amber Orange
    "SQL Database": "#8B5CF6",          // Purple
    "Virtual Machines": "#EF4444",      // Red
    "Bandwidth": "#06B6D4",             // Cyan
    "Container Registry": "#EC4899",    // Pink
    "Key Vault": "#84CC16",             // Lime
    "App Service": "#3B82F6",           // Bright Blue (fallback for App Service)
    "Other": "#6B7280"                  // Gray
  };
  
  return colors[serviceName as keyof typeof colors] || colors["Other"];
}
