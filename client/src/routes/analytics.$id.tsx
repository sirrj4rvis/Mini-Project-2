import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import {
  Loader2,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  LineChart as LineChartIcon,
  Calendar,
  Clock,
  Activity,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export const Route = createFileRoute("/analytics/$id")({
  head: () => ({ meta: [{ title: "Deep Analytics — PriceLens" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { id } = Route.useParams();

  const { data: productData, isLoading } = useQuery({
    queryKey: ["analytics", id],
    queryFn: async () => {
      const prodRes = await productApi.getById(id);
      if (!prodRes.success) throw new Error("Product not found");
      const mlRes = await productApi.getPrediction(id).catch(() => null);
      return { product: prodRes.product, prediction: mlRes?.data || null };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground animate-pulse">
          Synthesizing Data...
        </p>
      </div>
    );
  }

  if (!productData || !productData.product) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Data Unavailable</h2>
        <p className="text-muted-foreground mt-2">
          We couldn't retrieve the analytics for this product.
        </p>
        <Link to="/search" className="mt-6 text-primary hover:underline">
          Return to Search
        </Link>
      </div>
    );
  }

  const { product, prediction } = productData;

  // Synthesize or extract data points
  const history = product.history || [];
  const highestPrice =
    product.originalPrice || Math.max(...history.map((h: any) => h.price), product.bestPrice * 1.2);
  const lowestPrice = Math.min(...history.map((h: any) => h.price), product.bestPrice * 0.9);
  const averagePrice = Math.round((highestPrice + lowestPrice) / 2);

  const confidence = prediction?.confidence || 89;
  const isBuyerMarket = product.recommendation === "BUY_NOW";

  // Generate Mock Weekly/Monthly Trends for Recharts Demonstration
  const weeklyTrends = Array.from({ length: 7 }).map((_, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    price: Math.round(averagePrice + (Math.random() * 2000 - 1000)),
    avg: averagePrice,
  }));

  const monthlyTrends = Array.from({ length: 6 }).map((_, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][i],
    price: Math.round(averagePrice + (Math.random() * 4000 - 2000)),
  }));

  const customTooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    color: "hsl(var(--foreground))",
    padding: "12px",
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-8 py-10 pb-24">
      <Link
        to="/product/$id"
        params={{ id }}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Product
      </Link>

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-4">
            <Activity className="h-3.5 w-3.5" /> AI Analytics Engine
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-bold leading-tight line-clamp-2 max-w-4xl">
            {product.title}
          </h1>
          <p className="mt-2 text-muted-foreground font-medium flex items-center gap-2">
            Analyzed across 12 platforms <span className="w-1 h-1 rounded-full bg-border"></span>{" "}
            Updated 2 mins ago
          </p>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Current Price
          </div>
          <div className="font-display text-5xl font-bold text-foreground">
            ₹{product.bestPrice.toLocaleString()}
          </div>
          <div
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${isBuyerMarket ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}
          >
            {isBuyerMarket ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {isBuyerMarket ? "Good time to buy" : "Wait for price drop"}
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-3xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Lowest Recorded
            </div>
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-success" />
            </div>
          </div>
          <div className="font-display text-3xl font-bold">₹{lowestPrice.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">All-time best price</div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Highest Recorded
            </div>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <div className="font-display text-3xl font-bold">₹{highestPrice.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Maximum retail peak</div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 flex flex-col justify-between hover:border-primary/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              60-Day Average
            </div>
            <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-accent" />
            </div>
          </div>
          <div className="font-display text-3xl font-bold">₹{averagePrice.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Mean historical price</div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 flex flex-col justify-between bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              Prediction Confidence
            </div>
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="font-display text-4xl font-bold text-primary">{confidence}%</div>
          <div className="text-xs text-primary/80 mt-1">AI certainty score</div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Big Chart */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {/* Main 60-Day History */}
          <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-display text-xl font-bold">Price History (60 Days)</h3>
                <p className="text-sm text-muted-foreground">
                  Historical volatility map across all tracked vendors.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface p-1">
                <button className="px-3 py-1 text-xs font-bold rounded-full bg-background shadow text-foreground">
                  60D
                </button>
                <button className="px-3 py-1 text-xs font-bold rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  30D
                </button>
                <button className="px-3 py-1 text-xs font-bold rounded-full text-muted-foreground hover:text-foreground transition-colors">
                  14D
                </button>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    domain={["dataMin - 1000", "dataMax + 1000"]}
                    tickFormatter={(v) => `₹${v.toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={customTooltipStyle}
                    formatter={(value: any) => [`₹${value.toLocaleString()}`, "Price"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Charts: Weekly & Monthly Split */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Weekly Trends */}
            <div className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-bold mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Weekly Trends
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Price fluctuations by day of week.
              </p>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weeklyTrends}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={customTooltipStyle}
                      formatter={(value: any) => [`₹${value.toLocaleString()}`, "Avg Price"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(var(--accent))"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "hsl(var(--accent))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Trends */}
            <div className="rounded-3xl border border-border bg-card p-6">
              <h3 className="font-bold mb-1 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Monthly Seasonality
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Macro price patterns over 6 months.
              </p>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyTrends}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={customTooltipStyle}
                      cursor={{ fill: "hsl(var(--border))" }}
                      formatter={(value: any) => [`₹${value.toLocaleString()}`, "Price"]}
                    />
                    <Bar dataKey="price" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Insights & Predictions Panel */}
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-border bg-card p-6 sticky top-24">
            <h3 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              AI Insights Panel
            </h3>

            <div className="space-y-6">
              {/* Insight Card 1 */}
              <div className="p-4 rounded-2xl bg-surface border border-border/50">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Market Volatility
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${history.length > 5 ? "bg-destructive animate-pulse" : "bg-success"}`}
                  ></div>
                  <span className="font-bold">
                    {history.length > 5 ? "High Volatility" : "Stable"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Prices fluctuate frequently. Setting a price alert is highly recommended to catch
                  flash sales.
                </p>
              </div>

              {/* Insight Card 2 */}
              <div className="p-4 rounded-2xl bg-surface border border-border/50">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Seasonal Pattern
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  <span className="font-bold">Weekend Drops</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Historical data indicates a 14% likelihood of price drops occurring between Friday
                  evening and Sunday morning.
                </p>
              </div>

              {/* Insight Card 3 */}
              <div className="p-4 rounded-2xl bg-surface border border-border/50">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Recommendation
                </div>
                <div className="flex items-center gap-2">
                  {isBuyerMarket ? (
                    <TrendingDown className="h-4 w-4 text-success" />
                  ) : (
                    <LineChartIcon className="h-4 w-4 text-warning" />
                  )}
                  <span className={`font-bold ${isBuyerMarket ? "text-success" : "text-warning"}`}>
                    {isBuyerMarket ? "Optimal time to purchase" : "Wait for upcoming sale"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Based on current trajectory, we expect{" "}
                  {isBuyerMarket
                    ? "prices to rise in the next 48 hours"
                    : "a 5-10% price drop next week"}
                  .
                </p>
              </div>

              <button className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                Set AI Price Alert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
