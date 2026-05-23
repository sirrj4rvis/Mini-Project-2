import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, Bell, Wallet, Eye, ArrowUpRight, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useState, useEffect, useContext } from "react";
import { axiosPrivate } from "@/api/axios";
import { AuthContext } from "@/contexts/AuthContext";
import { adaptProduct } from "@/lib/data-adapter";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PriceLens" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useContext(AuthContext);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        // Fetch user's watchlist IDs from their profile
        const profileRes = await axiosPrivate.get("/auth/me");
        const watchlistIds: string[] = profileRes.data.user?.watchlist || [];

        // Fetch actual product data for each watchlist item
        const productPromises = watchlistIds.slice(0, 6).map((id: string) =>
          axiosPrivate
            .get(`/products/${id}`)
            .then((r) => r.data.product)
            .catch(() => null),
        );
        const rawProducts = await Promise.all(productPromises);
        setWatchlist(rawProducts.filter(Boolean).map((p: any) => adaptProduct(p)));

        // Fetch user's price alerts
        try {
          const alertsRes = await axiosPrivate.get("/alerts");
          if (alertsRes.data.success) {
            setAlerts(alertsRes.data.alerts || []);
          }
        } catch (e) {
          // alerts endpoint may not have data yet
        }
      } catch (err) {
        console.error("Dashboard data fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Compute real stats from fetched data
  const totalAlerts = alerts.length;
  const triggeredAlerts = alerts.filter((a: any) => a.triggered).length;
  const trackedCount = watchlist.length;
  const droppedCount = watchlist.filter((p: any) => p.discount > 0).length;

  const totalSaved = watchlist.reduce(
    (s: number, p: any) => s + Math.max(0, p.originalPrice - p.bestPrice),
    0,
  );
  const avgDiscount =
    trackedCount > 0
      ? Math.round(watchlist.reduce((s: number, p: any) => s + p.discount, 0) / trackedCount)
      : 0;

  const stats = [
    {
      l: "Total saved",
      v: `₹${totalSaved.toLocaleString()}`,
      c: TrendingDown,
      t: "Across all tracked products",
      color: "text-success",
    },
    {
      l: "Active alerts",
      v: String(totalAlerts),
      c: Bell,
      t: `${triggeredAlerts} triggered today`,
      color: "text-primary",
    },
    {
      l: "Tracked items",
      v: String(trackedCount),
      c: Eye,
      t: `${droppedCount} dropped in price`,
      color: "text-accent",
    },
    {
      l: "Avg. discount",
      v: `${avgDiscount}%`,
      c: Wallet,
      t: "Across tracked products",
      color: "text-warning",
    },
  ];

  const savingsData = [
    { m: "Jul", v: 1200 },
    { m: "Aug", v: 1800 },
    { m: "Sep", v: 2400 },
    { m: "Oct", v: 2100 },
    { m: "Nov", v: 3200 },
    { m: "Dec", v: 2900 },
    { m: "Jan", v: 3800 },
    { m: "Feb", v: 4500 },
  ];

  // Category breakdown from real watchlist
  const categoryMap: Record<string, number> = {};
  watchlist.forEach((p: any) => {
    const cat = p.category || "Other";
    categoryMap[cat] = (categoryMap[cat] || 0) + p.bestPrice;
  });
  const categorySpend = Object.entries(categoryMap).map(([c, v]) => ({ c, v }));

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Overview
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here's what's happening with your tracked products.
          </p>
        </div>
        <Link
          to="/search"
          className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground glow"
        >
          Track new product
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.l}
            className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 transition-all hover:border-primary/40"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.l}
                </div>
                <div className="mt-2 font-display text-3xl font-bold">{s.v}</div>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated ${s.color}`}
              >
                <s.c className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">{s.t}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Savings over time</h2>
              <p className="text-xs text-muted-foreground">Last 8 months</p>
            </div>
            <div className="font-display text-2xl font-bold text-success">
              +₹{totalSaved.toLocaleString()}
            </div>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savingsData}>
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 195)" />
                    <stop offset="100%" stopColor="oklch(0.7 0.18 295)" />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="m"
                  tick={{ fontSize: 11, fill: "oklch(0.68 0.02 255)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.21 0.025 260)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`₹${v.toLocaleString()}`, "Saved"]}
                />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="url(#lg)"
                  strokeWidth={3}
                  dot={{ fill: "oklch(0.78 0.16 195)", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-bold">Spend by category</h2>
          <p className="text-xs text-muted-foreground">From your watchlist</p>
          <div className="mt-6 h-64">
            {categorySpend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categorySpend} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <Bar dataKey="v" radius={8}>
                    {categorySpend.map((_, i) => (
                      <Cell key={i} fill={`oklch(0.78 0.16 ${195 + i * 25})`} />
                    ))}
                  </Bar>
                  <Tooltip
                    cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                    contentStyle={{
                      background: "oklch(0.21 0.025 260)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [`₹${v.toLocaleString()}`, "Value"]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground text-center px-4">
                Track products to see your category breakdown here.
              </div>
            )}
          </div>
          <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {categorySpend.map((c) => (
              <div key={c.c} className="flex justify-between">
                <span>{c.c}</span>
                <span className="font-medium text-foreground">₹{c.v.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tracked products */}
      <div className="mt-6 rounded-3xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-lg font-bold">Tracked products</h2>
          <Link
            to="/search"
            className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:gap-1.5 transition-all"
          >
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : watchlist.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Eye className="mx-auto h-10 w-10" />
            <p className="mt-4 font-display text-lg font-bold text-foreground">
              Your watchlist is empty
            </p>
            <p className="mt-1 text-sm">
              <Link to="/search" className="text-primary hover:underline">
                Search for products
              </Link>{" "}
              to start tracking prices.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {watchlist.map((p: any) => {
              const isDown = p.discount > 0;
              return (
                <Link
                  key={p.id}
                  to="/product/$id"
                  params={{ id: p.id }}
                  className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-surface/30"
                >
                  <div className="col-span-6 md:col-span-5 flex items-center gap-4">
                    <img
                      src={p.image}
                      alt=""
                      className="h-14 w-14 rounded-xl object-cover bg-surface-elevated"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {p.brand}
                      </div>
                      <div className="truncate text-sm font-semibold">{p.title}</div>
                    </div>
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <div className="font-display text-base font-bold">
                      ₹{p.bestPrice.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Lowest</div>
                  </div>
                  <div className="hidden md:block col-span-2 h-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={p.history || []}>
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke={isDown ? "oklch(0.74 0.17 155)" : "oklch(0.65 0.22 25)"}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div
                    className={`col-span-3 md:col-span-2 flex items-center justify-end gap-1 text-sm font-semibold ${isDown ? "text-success" : "text-warning"}`}
                  >
                    {isDown ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                    {p.discount.toFixed(1)}%
                  </div>
                  <div className="hidden md:flex col-span-1 justify-end">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${p.recommendation === "BUY_NOW" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                    >
                      {p.recommendation === "BUY_NOW" ? "Buy" : "Wait"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
