import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onProviderSelect?: (provider: "all" | "azure" | "mongodb") => void;
  onViewChange?: (view: "dashboard" | "azure" | "mongodb" | "aws" | "gcp" | "total") => void;
}

export default function Sidebar({ collapsed, activeSection, onSectionChange, onProviderSelect, onViewChange }: SidebarProps) {
  const cloudProviders = [
    { 
      id: "azure", 
      name: "Azure", 
      icon: "fab fa-microsoft", 
      status: "connected",
      active: true 
    },
    { 
      id: "aws", 
      name: "AWS", 
      icon: "fab fa-aws", 
      status: "connected",
      active: true 
    },
    { 
      id: "gcp", 
      name: "Google Cloud", 
      icon: "fab fa-google", 
      status: "connected",
      active: true 
    },
  ];

  const saasProviders = [
    { 
      id: "mongodb", 
      name: "MongoDB Atlas", 
      icon: "fas fa-database", 
      status: "connected",
      active: true 
    },
    { 
      id: "openai", 
      name: "OpenAI", 
      icon: "fas fa-brain", 
      status: "coming-soon",
      active: false 
    },
    { 
      id: "anthropic", 
      name: "Anthropic", 
      icon: "fas fa-robot", 
      status: "coming-soon",
      active: false 
    },
  ];

  const navigationItems = [
    {
      id: "total",
      name: "Total Cost",
      icon: "fas fa-chart-pie",
      section: "dashboard",
      view: "total"
    },
    { 
      id: "settings", 
      name: "Settings", 
      icon: "fas fa-cog",
      section: "settings"
    },
    { 
      id: "spn-management", 
      name: "SPN Management", 
      icon: "fas fa-key",
      section: "spn-management"
    },
  ];

  return (
    <aside 
      className={cn(
        "w-64 bg-card border-r border-border flex-shrink-0 transition-transform duration-300",
        collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
      )}
      data-testid="sidebar"
    >
      <div className="p-6">
        <nav className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Cloud Providers
            </h3>
            <ul className="space-y-1">
              {cloudProviders.map((provider) => (
                <li key={provider.id}>
                  <button
                    onClick={() => {
                      onSectionChange("dashboard");
                      if (provider.id === "azure" && onViewChange) {
                        console.log("🔥 AZURE SIDEBAR BUTTON CLICKED!");
                        onViewChange("azure");
                      }
                      if (provider.id === "aws" && onViewChange) {
                        console.log("🔥 AWS SIDEBAR BUTTON CLICKED!");
                        onViewChange("aws");
                      }
                      if (provider.id === "gcp" && onViewChange) {
                        console.log("🔥 GCP SIDEBAR BUTTON CLICKED!");
                        onViewChange("gcp");
                      }
                    }}
                    className={cn(
                      "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left",
                      provider.active && activeSection === "dashboard"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-muted",
                      !provider.active && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={!provider.active}
                    data-testid={`link-provider-${provider.id}`}
                  >
                    <i className={`${provider.icon} text-sm`}></i>
                    <span className={provider.active ? "font-medium" : ""}>{provider.name}</span>
                    {provider.status === "connected" && (
                      <span className="ml-auto w-2 h-2 bg-green-500 rounded-full"></span>
                    )}
                    {provider.status === "coming-soon" && (
                      <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                        Soon
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              SaaS Providers
            </h3>
            <ul className="space-y-1">
              {saasProviders.map((provider) => (
                <li key={provider.id}>
                  <button
                    onClick={() => {
                      onSectionChange("dashboard");
                      if (provider.id === "mongodb" && onViewChange) {
                        console.log("🔥 MONGODB SIDEBAR BUTTON CLICKED!");
                        onViewChange("mongodb");
                      }
                    }}
                    className={cn(
                      "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left",
                      provider.active && activeSection === "dashboard"
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-muted",
                      !provider.active && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={!provider.active}
                    data-testid={`link-provider-${provider.id}`}
                  >
                    <i className={`${provider.icon} text-sm`}></i>
                    <span className={provider.active ? "font-medium" : ""}>{provider.name}</span>
                    {provider.status === "connected" && (
                      <span className="ml-auto w-2 h-2 bg-green-500 rounded-full"></span>
                    )}
                    {provider.status === "coming-soon" && (
                      <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                        Soon
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="pt-4 border-t border-border">
            <ul className="space-y-1">
              {navigationItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onSectionChange(item.section);
                      // Navigate to a dashboard sub-view if provided
                      if ((item as any).view && onViewChange && item.section === "dashboard") {
                        onViewChange((item as any).view);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left",
                      activeSection === item.section
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    data-testid={`link-${item.id}`}
                  >
                    <i className={`${item.icon} text-sm`}></i>
                    <span>{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
}
