import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function OpenAIView() {
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
            <p className="text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">This page is intentionally left empty.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


