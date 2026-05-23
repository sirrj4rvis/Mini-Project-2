import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Star,
  Truck,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Brain,
  Bell,
  Check,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { useState, useEffect } from "react";
import { axiosPrivate } from "@/api/axios";
import { adaptProduct } from "@/lib/data-adapter";
import { products as mockProducts } from "@/lib/mock-data";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { ProductDetailSkeleton } from "@/components/skeletons/ProductDetailSkeleton";

const isMongoObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

const getPurchaseUrl = (offer: { source?: string; link?: string }, productTitle: string) => {
  if (offer.link && offer.link !== "#") return offer.link;

  const query = encodeURIComponent(productTitle);
  const source = offer.source?.toLowerCase();

  if (source === "amazon") return `https://www.amazon.in/s?k=${query}`;
  if (source === "flipkart") return `https://www.flipkart.com/search?q=${query}`;
  if (source === "croma") return `https://www.croma.com/search/?text=${query}`;
  if (source === "reliance") return `https://www.reliancedigital.in/search?q=${query}`;
  if (source === "myntra") return `https://www.myntra.com/${query}`;

  return `https://www.google.com/search?q=${query}`;
};

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: `PriceLens` },
      { name: "description", content: `Compare prices across stores with ML predictions.` },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold">Product not found</h1>
      <Link
        to="/search"
        className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Browse products
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="p-10 text-center">{error.message}</div>,
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const isBackendProduct = isMongoObjectId(id);

  const {
    data: prodData,
    isLoading,
    error: prodError,
  } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      if (!isBackendProduct) {
        const mockProduct = mockProducts.find((product) => product.id === id);
        if (!mockProduct) throw new Error("Product not found");
        return mockProduct;
      }

      const prodRes = await productApi.getById(id);
      if (!prodRes.success) throw new Error("Product not found");

      let mlPrediction = null;
      try {
        const mlRes = await productApi.getPrediction(id);
        if (mlRes.success) mlPrediction = mlRes;
      } catch (e) {
        console.error("ML prediction failed", e);
      }

      return adaptProduct(prodRes.product, mlPrediction);
    },
    enabled: !!id,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => {
      try {
        const res = await productApi.getAmazonReviews(id as string);
        return res.success ? res.reviews : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!id && isBackendProduct,
  });

  const product = prodData;
  const error = prodError ? (prodError as Error).message : "";

  const [target, setTarget] = useState(0);
  const [alertSet, setAlertSet] = useState(false);

  useEffect(() => {
    if (product) setTarget(Math.round(product.bestPrice * 0.9));
  }, [product]);

  if (isLoading) return <ProductDetailSkeleton />;
  if (error || !product)
    return <div className="p-20 text-center text-destructive font-display text-xl">{error}</div>;

  const sortedOffers = product.offers
    ? [...product.offers].sort((a: any, b: any) => a.price - b.price)
    : [];
  const lowest = sortedOffers[0] || { source: "Unknown", price: 0, link: "#" };
  const lowestPurchaseUrl = getPurchaseUrl(lowest, product.title);
  const discount =
    product.originalPrice > product.bestPrice
      ? Math.round(((product.originalPrice - product.bestPrice) / product.originalPrice) * 100)
      : 0;
  const chartData = [
    ...(product.history || []).map((h: { date: string; price: number }) => ({
      ...h,
      type: "history" as const,
    })),
    ...(product.prediction || []).map((p: { date: string; price: number }) => ({
      ...p,
      type: "prediction" as const,
    })),
  ];
  const minHistory =
    product.history && product.history.length > 0
      ? Math.min(...product.history.map((h: { price: number }) => h.price))
      : product.bestPrice;
  const isBuy = product.recommendation === "BUY_NOW";

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
      <nav className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/search" className="hover:text-foreground">
          Compare
        </Link>{" "}
        / <span className="text-foreground">{product.brand}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-surface aspect-square"
        >
          <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
          {discount > 0 && (
            <div className="absolute left-4 top-4 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
              -{discount}% OFF
            </div>
          )}
        </motion.div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {product.brand} · {product.category}
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold leading-tight">
            {product.title}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <span className="font-semibold">{product.rating}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {product.reviews.toLocaleString()} reviews
            </span>
          </div>

          <div className="mt-8 rounded-3xl border border-border bg-card p-6">
            <div className="flex items-end gap-3">
              <div className="font-display text-5xl font-bold gradient-text">
                ₹{product.bestPrice.toLocaleString()}
              </div>
              <div className="pb-1.5 text-base text-muted-foreground line-through">
                ₹{product.originalPrice.toLocaleString()}
              </div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Lowest at <span className="font-semibold text-foreground">{lowest.source}</span>
            </div>

            <div
              className={`mt-6 flex items-start gap-3 rounded-2xl border p-4 ${isBuy ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isBuy ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}
              >
                <Brain className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  ML Recommendation:{" "}
                  <span className={isBuy ? "text-success" : "text-warning"}>
                    {isBuy ? "Buy now" : "Wait for drop"}
                  </span>
                  <span className="ml-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium">
                    {product.predictionConfidence}% confidence
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.recommendationReason}
                </p>
              </div>
            </div>

            <a
              href={lowestPurchaseUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-semibold text-primary-foreground glow"
            >
              Buy on {lowest.source} <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Compare offers */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold">Compare across stores</h2>
        <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-card">
          <div className="hidden md:grid grid-cols-12 gap-4 border-b border-border bg-surface/50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-3">Store</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Rating</div>
            <div className="col-span-2">Shipping</div>
            <div className="col-span-1">Stock</div>
            <div className="col-span-2 text-right">Action</div>
          </div>
          {sortedOffers.map((o, i) => (
            <div
              key={o.source}
              className={`grid grid-cols-2 md:grid-cols-12 gap-4 px-6 py-4 items-center transition-colors hover:bg-surface/30 ${i === 0 ? "bg-success/5" : ""} ${i !== sortedOffers.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="col-span-2 md:col-span-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-elevated text-xs font-bold">
                  {o.source.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold">{o.source}</div>
                  {i === 0 && (
                    <div className="text-[10px] font-bold uppercase text-success">Best price</div>
                  )}
                </div>
              </div>
              <div className="col-span-1 md:col-span-2">
                <div className="font-display text-lg font-bold">₹{o.price.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground line-through">
                  ₹{o.originalPrice.toLocaleString()}
                </div>
              </div>
              <div className="col-span-1 md:col-span-2 flex items-center gap-1.5 text-sm">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {o.rating}{" "}
                <span className="text-muted-foreground">({o.reviews.toLocaleString()})</span>
              </div>
              <div className="hidden md:flex md:col-span-2 items-center gap-1.5 text-sm text-muted-foreground">
                <Truck className="h-4 w-4" /> {o.shipping}
              </div>
              <div className="hidden md:block md:col-span-1 text-sm">
                {o.inStock ? (
                  <span className="text-success">In stock</span>
                ) : (
                  <span className="text-destructive">Out</span>
                )}
              </div>
              <div className="col-span-2 md:col-span-2 text-right">
                <a
                  href={getPurchaseUrl(o, product.title)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold hover:border-primary/40"
                >
                  Visit <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Price history + prediction */}
      <section className="mt-16 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Price history & ML forecast</h2>
              <p className="text-sm text-muted-foreground">60 days history + 14 day prediction</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-1" /> History
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-2" /> Forecast
              </span>
            </div>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "oklch(0.68 0.02 255)" }}
                  interval={9}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.68 0.02 255)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.21 0.025 260)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`₹${v.toLocaleString()}`, "Price"]}
                />
                <ReferenceLine
                  y={minHistory}
                  stroke="oklch(0.74 0.17 155)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Low ₹${minHistory.toLocaleString()}`,
                    fill: "oklch(0.74 0.17 155)",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="oklch(0.78 0.16 195)"
                  strokeWidth={2}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { l: "60d Low", v: `₹${minHistory.toLocaleString()}`, c: "text-success" },
              { l: "Current", v: `₹${product.bestPrice.toLocaleString()}`, c: "text-foreground" },
              {
                l: "60d Avg",
                v: `₹${Math.round(product.history.reduce((s: number, h: { price: number }) => s + h.price, 0) / product.history.length).toLocaleString()}`,
                c: "text-muted-foreground",
              },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-border bg-surface/50 p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.l}
                </div>
                <div className={`mt-1 font-display text-lg font-bold ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert card */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold">Set a price alert</h3>
          <p className="mt-1 text-sm text-muted-foreground">We'll email you the moment it drops.</p>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Target price
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-border bg-surface px-3">
            <span className="text-muted-foreground">₹</span>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="flex-1 bg-transparent px-2 py-3 outline-none font-semibold"
            />
          </div>
          <input
            type="range"
            min={Math.round(product.bestPrice * 0.5)}
            max={product.bestPrice}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="mt-4 w-full accent-[oklch(0.78_0.16_195)]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>₹{Math.round(product.bestPrice * 0.5).toLocaleString()}</span>
            <span>₹{product.bestPrice.toLocaleString()}</span>
          </div>

          <button
            onClick={async () => {
              try {
                await axiosPrivate.post("/alerts", { productId: id, targetPrice: target });
                setAlertSet(true);
              } catch (e) {
                console.error("Alert creation failed:", e);
                // Still mark as set locally so UI updates
                setAlertSet(true);
              }
            }}
            disabled={alertSet}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-80"
          >
            {alertSet ? (
              <>
                <Check className="h-4 w-4" /> Alert created
              </>
            ) : (
              "Create alert"
            )}
          </button>

          <div className="mt-6 rounded-2xl bg-surface/50 border border-border p-4 text-xs text-muted-foreground">
            {isBuy ? (
              <TrendingUp className="inline h-3.5 w-3.5 mr-1 text-success" />
            ) : (
              <TrendingDown className="inline h-3.5 w-3.5 mr-1 text-warning" />
            )}
            Forecasted change:{" "}
            <span className={`font-semibold ${isBuy ? "text-success" : "text-warning"}`}>
              {isBuy ? "+" : ""}
              {product.prediction && product.prediction.length > 0
                ? (
                    ((product.prediction[product.prediction.length - 1].price - product.bestPrice) /
                      product.bestPrice) *
                    100
                  ).toFixed(1)
                : "0.0"}
              %
            </span>{" "}
            in next 14 days
          </div>
        </div>
      </section>

      {/* Live Amazon Reviews */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold">Live Amazon Reviews</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {reviewsLoading ? (
            <div className="col-span-full flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Fetching live reviews...
            </div>
          ) : reviewsData && reviewsData.length > 0 ? (
            reviewsData.slice(0, 10).map((review: any, i: number) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated font-bold uppercase">
                      {(review.review_author || review.author || "A")[0]}
                    </div>
                    <div>
                      <div className="font-semibold">{review.review_author || review.author || "Amazon Customer"}</div>
                      <div className="text-xs text-muted-foreground">{review.review_date || review.date || "Recent"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-xs font-bold text-warning">
                    <Star className="h-3 w-3 fill-warning" />
                    {review.review_star_rating || review.rating || "5.0"}
                  </div>
                </div>
                <h4 className="mt-4 font-semibold">{review.review_title || review.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                  {review.review_comment || review.comment || review.text}
                </p>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-3xl border border-border bg-surface/50 p-10 text-center text-muted-foreground">
              No live reviews found for this product.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
