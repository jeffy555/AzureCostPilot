import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Key, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertServicePrincipalSchema, type ServicePrincipal } from "@shared/schema";
import type { z } from "zod";

interface SPNManagementProps {
  servicePrincipals?: ServicePrincipal[];
}

type FormData = z.infer<typeof insertServicePrincipalSchema>;

export default function SPNManagement({ servicePrincipals = [] }: SPNManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(insertServicePrincipalSchema),
    defaultValues: {
      name: "",
      clientId: "",
      clientSecret: "",
      tenantId: "",
      subscriptionId: "",
      status: "active",
    },
  });

  const createSPNMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/service-principals", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-principals"] });
      toast({
        title: "Success",
        description: "Service Principal created successfully",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create Service Principal",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (spnId: string) => {
      const response = await apiRequest("POST", `/api/service-principals/${spnId}/test-connection`);
      return response.json();
    },
    onSuccess: (data, spnId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-principals"] });
      toast({
        title: "Success",
        description: "Connection test successful",
      });
    },
    onError: (error, spnId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-principals"] });
      toast({
        title: "Connection Failed",
        description: "Unable to connect with this Service Principal",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createSPNMutation.mutate(data);
  };

  const getStatusBadge = (spn: ServicePrincipal) => {
    if (spn.status === "active") {
      return (
        <Badge className="bg-green-100 text-green-800">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
          Connected
        </Badge>
      );
    } else if (spn.status === "error") {
      return (
        <Badge className="bg-red-100 text-red-800">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>
          Error
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-100 text-yellow-800">
        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5"></span>
        Disabled
      </Badge>
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  const maskId = (id: string) => {
    if (id.length < 8) return id;
    return `${id.substring(0, 8)}-****-****-${id.substring(id.length - 4)}`;
  };

  return (
    <Card data-testid="spn-management">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Service Principal Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage Azure service principal credentials for cost data access
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-spn">
                <Plus className="mr-2 h-4 w-4" />
                Add SPN
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-spn">
              <DialogHeader>
                <DialogTitle>Add Service Principal</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Production SPN" 
                            {...field} 
                            data-testid="input-spn-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="12345678-1234-5678-9012-123456789012" 
                            {...field}
                            data-testid="input-client-id"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="clientSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input 
                            type="password"
                            placeholder="Enter client secret" 
                            {...field}
                            data-testid="input-client-secret"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tenantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="87654321-4321-8765-4321-876543210987" 
                            {...field}
                            data-testid="input-tenant-id"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subscriptionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subscription ID</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="11111111-2222-3333-4444-555555555555" 
                            {...field}
                            data-testid="input-subscription-id"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createSPNMutation.isPending}
                      data-testid="button-create-spn"
                    >
                      {createSPNMutation.isPending ? "Creating..." : "Create SPN"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {servicePrincipals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-spns">
            No Service Principals configured. Add one to start fetching cost data.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {servicePrincipals.map((spn) => (
              <Card key={spn.id} className="border" data-testid={`card-spn-${spn.id}`}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Key className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground" data-testid={`text-spn-name-${spn.id}`}>
                          {spn.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">Cost Management Reader</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(spn)}
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client ID:</span>
                      <span className="font-mono text-foreground">{maskId(spn.clientId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tenant ID:</span>
                      <span className="font-mono text-foreground">{maskId(spn.tenantId)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subscription:</span>
                      <span className="text-foreground">{spn.subscriptionId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {spn.status === "error" ? "Last Error:" : "Last Sync:"}
                      </span>
                      <span className={spn.status === "error" ? "text-destructive" : "text-foreground"}>
                        {spn.status === "error" 
                          ? spn.errorMessage || "Unknown error" 
                          : formatDate(spn.lastSync)
                        }
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2 border-t border-border">
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      size="sm"
                      onClick={() => testConnectionMutation.mutate(spn.id)}
                      disabled={testConnectionMutation.isPending}
                      data-testid={`button-test-connection-${spn.id}`}
                    >
                      {spn.status === "error" ? "Retry Connection" : "Test Connection"}
                    </Button>
                    <Button 
                      variant={spn.status === "error" ? "destructive" : "secondary"}
                      className="flex-1" 
                      size="sm"
                      data-testid={`button-update-credentials-${spn.id}`}
                    >
                      {spn.status === "error" ? "Fix Credentials" : "Update Credentials"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
