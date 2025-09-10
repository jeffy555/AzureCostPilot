import "dotenv/config";
import { 
  type User, 
  type InsertUser, 
  type ServicePrincipal, 
  type InsertServicePrincipal,
  type CostData,
  type InsertCostData,
  type CostSummary,
  type InsertCostSummary
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Service Principal methods
  getServicePrincipals(): Promise<ServicePrincipal[]>;
  getServicePrincipal(id: string): Promise<ServicePrincipal | undefined>;
  createServicePrincipal(spn: InsertServicePrincipal): Promise<ServicePrincipal>;
  updateServicePrincipal(id: string, updates: Partial<ServicePrincipal>): Promise<ServicePrincipal | undefined>;
  deleteServicePrincipal(id: string): Promise<boolean>;
  
  // Cost Data methods
  getCostData(filters?: { spnId?: string; dateFrom?: Date; dateTo?: Date }): Promise<CostData[]>;
  createCostData(data: InsertCostData): Promise<CostData>;
  bulkCreateCostData(data: InsertCostData[]): Promise<CostData[]>;
  clearCostDataByProviderType(provider: string): Promise<void>;
  
  // Cost Summary methods
  getLatestCostSummary(): Promise<CostSummary | undefined>;
  createCostSummary(summary: InsertCostSummary): Promise<CostSummary>;
  updateCostSummary(id: string, updates: Partial<CostSummary>): Promise<CostSummary | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private servicePrincipals: Map<string, ServicePrincipal>;
  private costData: Map<string, CostData>;
  private costSummaries: Map<string, CostSummary>;

  constructor() {
    this.users = new Map();
    this.servicePrincipals = new Map();
    this.costData = new Map();
    this.costSummaries = new Map();
    
    // Initialize with Azure credentials from environment if available
    this.initializeAzureCredentials();
  }

  private initializeAzureCredentials() {
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const tenantId = process.env.AZURE_TENANT_ID;
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    
    if (clientId && clientSecret && tenantId && subscriptionId) {
      const defaultSPN: ServicePrincipal = {
        id: randomUUID(),
        name: "Azure Production SPN",
        provider: "azure",
        clientId,
        clientSecret,
        tenantId,
        subscriptionId,
        publicKey: null,
        privateKey: null,
        orgId: null,
        projectId: null,
        status: "active",
        lastSync: null,
        errorMessage: null,
        createdAt: new Date(),
      };
      
      this.servicePrincipals.set(defaultSPN.id, defaultSPN);
      console.log('Initialized default Azure service principal from environment variables');
    }

    // Initialize MongoDB Atlas credentials
    const mongoPublicKey = process.env.MONGODB_PUBLIC_KEY;
    const mongoPrivateKey = process.env.MONGODB_PRIVATE_KEY;
    const mongoOrgId = process.env.MONGODB_ORG_ID;
    const mongoProjectId = process.env.MONGODB_PROJECT_ID;

    if (mongoPublicKey && mongoPrivateKey && mongoOrgId) {
      const mongoSPN: ServicePrincipal = {
        id: randomUUID(),
        name: "MongoDB Atlas Production",
        provider: "mongodb",
        clientId: null,
        clientSecret: null,
        tenantId: null,
        subscriptionId: null,
        publicKey: mongoPublicKey,
        privateKey: mongoPrivateKey,
        orgId: mongoOrgId,
        projectId: mongoProjectId || null,
        status: "active",
        lastSync: null,
        errorMessage: null,
        createdAt: new Date(),
      };
      
      this.servicePrincipals.set(mongoSPN.id, mongoSPN);
      console.log('Initialized default MongoDB Atlas service principal from environment variables');
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getServicePrincipals(): Promise<ServicePrincipal[]> {
    return Array.from(this.servicePrincipals.values());
  }

  async getServicePrincipal(id: string): Promise<ServicePrincipal | undefined> {
    return this.servicePrincipals.get(id);
  }

  async createServicePrincipal(spn: InsertServicePrincipal): Promise<ServicePrincipal> {
    const id = randomUUID();
    const servicePrincipal: ServicePrincipal = { 
      ...spn, 
      id, 
      createdAt: new Date(),
      lastSync: null,
      errorMessage: null,
      status: spn.status || "active",
      // Ensure required fields are not undefined
      clientId: spn.clientId || null,
      clientSecret: spn.clientSecret || null,
      tenantId: spn.tenantId || null,
      subscriptionId: spn.subscriptionId || null,
      publicKey: spn.publicKey || null,
      privateKey: spn.privateKey || null,
      orgId: spn.orgId || null,
      projectId: spn.projectId || null
    };
    this.servicePrincipals.set(id, servicePrincipal);
    return servicePrincipal;
  }

  async updateServicePrincipal(id: string, updates: Partial<ServicePrincipal>): Promise<ServicePrincipal | undefined> {
    const existing = this.servicePrincipals.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.servicePrincipals.set(id, updated);
    return updated;
  }

  async deleteServicePrincipal(id: string): Promise<boolean> {
    return this.servicePrincipals.delete(id);
  }

  async getCostData(filters?: { spnId?: string; providerId?: string; dateFrom?: Date; dateTo?: Date }): Promise<CostData[]> {
    let data = Array.from(this.costData.values());
    
    if (filters?.spnId || filters?.providerId) {
      const targetId = filters.spnId || filters.providerId;
      data = data.filter(item => item.providerId === targetId);
    }
    
    if (filters?.dateFrom) {
      data = data.filter(item => new Date(item.date) >= filters.dateFrom!);
    }
    
    if (filters?.dateTo) {
      data = data.filter(item => new Date(item.date) <= filters.dateTo!);
    }
    
    return data;
  }

  async createCostData(data: InsertCostData): Promise<CostData> {
    const id = randomUUID();
    const costEntry: CostData = { 
      ...data, 
      id, 
      createdAt: new Date(),
      providerId: data.providerId || null,
      resourceGroup: data.resourceGroup || null,
      serviceName: data.serviceName || null,
      location: data.location || null,
      clusterName: data.clusterName || null,
      databaseName: data.databaseName || null,
      serviceType: data.serviceType || null,
      region: data.region || null,
      dailyCost: data.dailyCost || null,
      monthlyCost: data.monthlyCost || null,
      currency: data.currency || "USD",
      metadata: data.metadata || null
    };
    this.costData.set(id, costEntry);
    return costEntry;
  }

  async clearCostDataByProvider(providerId: string): Promise<void> {
    const entries = Array.from(this.costData.entries());
    for (const [id, entry] of entries) {
      if (entry.providerId === providerId) {
        this.costData.delete(id);
      }
    }
  }

  async clearCostDataByProviderType(provider: string): Promise<void> {
    const entries = Array.from(this.costData.entries());
    for (const [id, entry] of entries) {
      if (entry.provider === provider) {
        this.costData.delete(id);
      }
    }
  }

  async bulkCreateCostData(data: InsertCostData[]): Promise<CostData[]> {
    // Clear existing cost data to avoid duplication
    this.costData.clear();
    
    const results: CostData[] = [];
    for (const item of data) {
      const created = await this.createCostData(item);
      results.push(created);
    }
    return results;
  }

  async getLatestCostSummary(): Promise<CostSummary | undefined> {
    const summaries = Array.from(this.costSummaries.values());
    return summaries.sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())[0];
  }

  async createCostSummary(summary: InsertCostSummary): Promise<CostSummary> {
    const id = randomUUID();
    const costSummary: CostSummary = { 
      ...summary, 
      id, 
      lastUpdated: new Date(),
      totalMonthlyCost: summary.totalMonthlyCost || null,
      todaySpend: summary.todaySpend || null,
      activeResources: summary.activeResources || null,
      budgetUtilization: summary.budgetUtilization || null,
      trendData: summary.trendData || null,
      serviceBreakdown: summary.serviceBreakdown || null
    };
    this.costSummaries.set(id, costSummary);
    return costSummary;
  }

  async updateCostSummary(id: string, updates: Partial<CostSummary>): Promise<CostSummary | undefined> {
    const existing = this.costSummaries.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates, lastUpdated: new Date() };
    this.costSummaries.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
