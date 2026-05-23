import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { TrendingUp, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useState, useContext } from "react";
import { axiosInstance } from "@/api/axios";
import { AuthContext } from "@/contexts/AuthContext";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — PriceLens" }] }),
  component: Login,
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useContext(AuthContext);

  // Redirect if already logged in
  if (isAuthenticated) {
    navigate({ to: "/dashboard" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await axiosInstance.post("/auth/login", { email, password });
      if (response.data.success) {
        login(response.data.accessToken, response.data.refreshToken, response.data.user);
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      // express-validator sends errors[].msg, API errors send .message
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.errors?.[0]?.message ||
        "Login failed. Please check your credentials and try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-16">
      <div className="w-full">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent glow">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold">
              Price<span className="gradient-text">Lens</span>
            </span>
          </Link>
          <h1 className="mt-8 font-display text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to track prices and manage alerts.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-3xl border border-border bg-card p-7"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
            />
          </div>

          <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Password
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" className="accent-primary" /> Remember me
            </label>
            <a href="#" className="font-semibold text-primary hover:underline">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent py-3 text-sm font-semibold text-primary-foreground glow disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign in <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            className="w-full rounded-full border border-border bg-surface py-3 text-sm font-semibold hover:border-primary/40"
          >
            Continue with Google
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
