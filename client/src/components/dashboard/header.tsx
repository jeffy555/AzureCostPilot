import { Cloud, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onToggleSidebar: () => void;
  onRefresh: () => void;
  lastUpdated?: string;
  isRefreshing?: boolean;
}

export default function Header({ onToggleSidebar, onRefresh, lastUpdated, isRefreshing }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50" data-testid="header">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <button 
            className="lg:hidden p-2 hover:bg-muted rounded-md" 
            onClick={onToggleSidebar}
            data-testid="button-toggle-sidebar"
          >
            <i className="fas fa-bars text-muted-foreground"></i>
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Cloud className="text-primary-foreground text-sm" />
            </div>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-app-title">
              Cloud Cost Dashboard
            </h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
            <span>Last Updated:</span>
            <span className="font-medium" data-testid="text-last-updated">
              {lastUpdated || "Never"}
            </span>
          </div>
          
          <Button 
            onClick={onRefresh}
            className="flex items-center space-x-2"
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={cn("text-sm", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
