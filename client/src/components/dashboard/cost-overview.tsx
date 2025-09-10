import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, Server, PieChart } from "lucide-react";
import type { CostSummary } from "@shared/schema";

interface CostOverviewProps {
  summary?: CostSummary;
}

export default function CostOverview({ summary }: CostOverviewProps) {
  const cards = [
    {
      title: "Total Monthly Cost",
      value: summary ? `₹${summary.totalMonthlyCost}` : "₹0.00",
      change: "-12.5% from last month",
      changeType: "positive",
      icon: DollarSign,
      color: "text-primary",
      testId: "card-total-monthly-cost"
    },
    {
      title: "Today's Spend",
      value: summary ? `₹${summary.todaySpend}` : "₹0.00",
      change: "+8.2% from yesterday", 
      changeType: "negative",
      icon: Calendar,
      color: "text-accent",
      testId: "card-today-spend"
    },
    {
      title: "Active Resources",
      value: summary?.activeResources || "0",
      change: "Across 12 resource groups",
      changeType: "neutral",
      icon: Server,
      color: "text-chart-2",
      testId: "card-active-resources"
    },
    {
      title: "Budget Utilization",
      value: summary ? `${summary.budgetUtilization}%` : "0%",
      change: "Budget data not available",
      changeType: "warning",
      icon: PieChart,
      color: "text-chart-4",
      testId: "card-budget-utilization"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="cost-overview">
      {cards.map((card) => (
        <Card key={card.title} className="fade-in" data-testid={card.testId}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {card.title}
              </h3>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground" data-testid={`text-${card.testId}-value`}>
                {card.value}
              </p>
              <p className={`text-sm flex items-center ${
                card.changeType === "positive" ? "text-green-600" :
                card.changeType === "negative" ? "text-red-600" :
                card.changeType === "warning" ? "text-orange-600" :
                "text-muted-foreground"
              }`}>
                {card.changeType === "positive" && (
                  <i className="fas fa-arrow-down text-xs mr-1"></i>
                )}
                {card.changeType === "negative" && (
                  <i className="fas fa-arrow-up text-xs mr-1"></i>
                )}
                <span>{card.change}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
