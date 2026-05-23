import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { TrendingUp, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useState, useContext } from "react";
import { axiosInstance } from "@/api/axios";
import { AuthContext } from "@/contexts/AuthContext";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create Account — PriceLens" }] }),
  component: Register,
});

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useContext(AuthContext);

  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    navigate({ to: "/dashboard" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axiosInstance.post("/auth/register", {
        name: name.trim(),
        email,
        password,
      });

      if (response.data.success) {
        login(response.data.accessToken, response.data.refreshToken, response.data.user);
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      // express-validator uses `msg` field, not `message`
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.errors?.[0]?.message ||
        "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-16">
      <div className="w-full">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent glow">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold">
              Price<span className="gradient-text">Lens</span>
            </span>
          </Link>
          <h1 className="mt-8 font-display text-3xl font-bold">Create account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start tracking prices and saving money today.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-3xl border border-border bg-card p-7"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Name */}
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Full Name
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
            <User className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
            />
          </div>

          {/* Email */}
          <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

          {/* Password */}
          <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Password
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
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

          {/* Password strength hint */}
          {password.length > 0 && (
            <p
              className={`mt-1 text-xs ${password.length >= 8 ? "text-green-500" : "text-destructive"}`}
            >
              {password.length >= 8
                ? "✓ Strong enough"
                : `${8 - password.length} more characters needed`}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || password.length < 8}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent py-3 text-sm font-semibold text-primary-foreground glow disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By signing up, you agree to our{" "}
            <a href="#" className="underline hover:text-foreground">
              Terms
            </a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
