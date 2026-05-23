import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Users, ShoppingBag, Bell, MessageSquare, LayoutDashboard, Settings, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, DashboardData } from "@/api/adminApi";
import { StatCard } from "@/components/admin/StatCard";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { ProductManagementTable } from "@/components/admin/ProductManagementTable";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, Cell, LineChart, Line } from "recharts";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — PriceLens" }] }),
  component: AdminPage,
});

type Tab = "overview" | "users" | "products" | "settings";

function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin Guard
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      toast.error("Unauthorized access");
      router.history.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDashboardStats();
      setData(res);
    } catch (error) {
      toast.error("Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "admin") {
      fetchDashboard();
    }
  }, [user]);

  if (authLoading || (loading && !data)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row bg-background">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-r border-border bg-card/50 px-4 py-6 flex-shrink-0 overflow-y-auto">
        <div className="mb-8 px-2 hidden md:block">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Admin Control</div>
          <div className="text-sm font-medium mt-1">{user.name}</div>
        </div>
        
        <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0 hide-scrollbar">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-surface hover:text-foreground'}`}
          >
            <LayoutDashboard className="h-4 w-4" /> Overview
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'users' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-surface hover:text-foreground'}`}
          >
            <Users className="h-4 w-4" /> User Management
          </button>
          <button 
            onClick={() => setActiveTab("products")}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'products' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-surface hover:text-foreground'}`}
          >
            <ShoppingBag className="h-4 w-4" /> Products & Alerts
          </button>
          <div className="hidden md:block my-2 border-t border-border/50"></div>
          <button 
            onClick={() => toast.info("Settings coming soon")}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap text-muted-foreground hover:bg-surface hover:text-foreground`}
          >
            <Settings className="h-4 w-4" /> System Settings
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && data && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="font-display text-3xl font-bold mb-6">Platform Analytics</h1>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard 
                label="Total Users" 
                value={data.stats.totalUsers.toLocaleString()} 
                icon={Users} 
                subtext={`+${data.recentUsers.length} recent signups`}
                colorClass="text-blue-500"
              />
              <StatCard 
                label="Active Products" 
                value={data.stats.totalProducts.toLocaleString()} 
                icon={ShoppingBag} 
                subtext="Currently tracked globally"
                colorClass="text-green-500"
              />
              <StatCard 
                label="Price Alerts" 
                value={data.stats.activeAlerts.toLocaleString()} 
                icon={Bell} 
                subtext="Waiting for price drops"
                colorClass="text-purple-500"
              />
              <StatCard 
                label="Forum Posts" 
                value={data.stats.totalForumPosts.toLocaleString()} 
                icon={MessageSquare} 
                subtext="Community discussions"
                colorClass="text-amber-500"
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> System Activity
                  </h2>
                </div>
                <div className="h-64">
                  {/* Mock chart for system activity since backend doesn't have timeseries data yet */}
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[
                      { name: 'Mon', queries: 400, signups: 24 },
                      { name: 'Tue', queries: 300, signups: 13 },
                      { name: 'Wed', queries: 550, signups: 45 },
                      { name: 'Thu', queries: 450, signups: 30 },
                      { name: 'Fri', queries: 700, signups: 60 },
                      { name: 'Sat', queries: 600, signups: 40 },
                      { name: 'Sun', queries: 800, signups: 75 },
                    ]}>
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "oklch(0.68 0.02 255)" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "oklch(0.21 0.025 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                      <Line type="monotone" dataKey="queries" stroke="oklch(0.78 0.16 195)" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="signups" stroke="oklch(0.7 0.18 295)" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" /> Top Products (Search Vol)
                  </h2>
                </div>
                <div className="h-64">
                  {data.topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.topProducts.map(p => ({ name: p.title.substring(0, 15)+'...', val: p.searchCount }))}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.68 0.02 255)" }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.04)" }} contentStyle={{ background: "oklch(0.21 0.025 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                        <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                          {data.topProducts.map((_, i) => (
                            <Cell key={i} fill={`oklch(0.78 0.16 ${195 + i * 25})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                     <div className="h-full flex items-center justify-center text-muted-foreground">No product data available</div>
                  )}
                </div>
              </div>
            </div>
            
            <ProductManagementTable products={data.topProducts} onRefresh={fetchDashboard} />
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <UserManagementTable />
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === "products" && data && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Reusing the top products component for now, could be expanded to a full paginated list if backend adds /api/admin/products */}
            <div className="mb-6">
              <h1 className="font-display text-3xl font-bold">Products & Alerts</h1>
              <p className="text-muted-foreground mt-2">Manage the products currently being tracked globally.</p>
            </div>
            
            <ProductManagementTable products={data.topProducts} onRefresh={fetchDashboard} />
          </div>
        )}

      </main>
    </div>
  );
}
