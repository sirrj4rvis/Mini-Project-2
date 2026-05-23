import { createFileRoute } from "@tanstack/react-router";
import { Bell, Check, Trash2, Mail, Zap, Loader2 } from "lucide-react";
import { useState, useEffect, useContext } from "react";
import { axiosPrivate } from "@/api/axios";
import { AuthContext } from "@/contexts/AuthContext";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [{ title: "Price alerts — PriceLens" }] }),
  component: Alerts,
});

interface AlertItem {
  _id: string;
  productId: {
    _id: string;
    title: string;
    brand: string;
    imageUrl: string;
    lowestPrice: number;
  };
  targetPrice: number;
  triggered: boolean;
  isActive: boolean;
}

function Alerts() {
  const { user } = useContext(AuthContext);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setIsLoading(true);
        const res = await axiosPrivate.get("/alerts");
        if (res.data.success) {
          setAlerts(res.data.alerts || []);
        }
      } catch (err: any) {
        setError("Failed to load your alerts.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const remove = async (id: string) => {
    try {
      await axiosPrivate.delete(`/alerts/${id}`);
      setAlerts(alerts.filter((a) => a._id !== id));
    } catch (e) {
      console.error("Failed to delete alert:", e);
    }
  };

  const activeAlerts = alerts.filter((a) => a.isActive);
  const triggeredToday = alerts.filter((a) => a.triggered);

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-8 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Notifications
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold">Price alerts</h1>
          <p className="mt-1 text-muted-foreground">
            Get notified the instant prices drop to your target.
          </p>
        </div>
        {user?.email && (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-surface/50 px-4 py-2 text-sm">
            <Mail className="h-4 w-4 text-primary" /> {user.email}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { l: "Active", v: activeAlerts.length, c: "text-primary" },
          { l: "Triggered today", v: triggeredToday.length, c: "text-success" },
          { l: "Total tracked", v: alerts.length, c: "text-warning" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className={`mt-1 font-display text-2xl font-bold ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-12 text-center text-destructive">
            {error}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-16 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-4 font-display text-xl font-bold">No alerts yet</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse products to set your first price alert.
            </p>
          </div>
        ) : (
          alerts.map((a) => {
            const product = a.productId;
            if (!product) return null;
            const currentPrice = product.lowestPrice || 0;
            const diff =
              currentPrice > 0 ? ((currentPrice - a.targetPrice) / a.targetPrice) * 100 : 0;
            const isBelowTarget = diff <= 0;

            return (
              <div
                key={a._id}
                className={`group rounded-3xl border bg-card p-5 transition-all ${isBelowTarget ? "border-success/40 bg-success/5" : "border-border hover:border-primary/40"}`}
              >
                <div className="flex items-center gap-4">
                  <img
                    src={product.imageUrl || "https://placehold.co/80x80?text=Product"}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover bg-surface-elevated"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {product.brand || "Unknown"}
                    </div>
                    <div className="truncate font-semibold">{product.title}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        Target:{" "}
                        <span className="font-semibold text-foreground">
                          ₹{a.targetPrice.toLocaleString()}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Current:{" "}
                        <span className="font-semibold text-foreground">
                          ₹{currentPrice.toLocaleString()}
                        </span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${isBelowTarget ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                      >
                        {isBelowTarget ? "✓ Below target" : `${diff.toFixed(1)}% above`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isBelowTarget && (
                      <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1.5 text-xs font-bold text-success">
                        <Check className="h-3 w-3" /> Triggered
                      </span>
                    )}
                    <button
                      onClick={() => remove(a._id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-12 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-xl font-bold">Smart alerts on autopilot</div>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Upgrade to Pro to get SMS + WhatsApp alerts, predictive triggers powered by ML, and
              unlimited tracked products.
            </p>
            <button className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background">
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
