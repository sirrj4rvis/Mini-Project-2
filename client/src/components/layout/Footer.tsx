import { Link } from "@tanstack/react-router";
import { Mail, ArrowRight } from "lucide-react";

type SocialIconProps = {
  className?: string;
};

function Instagram({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function Twitter({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6.8c-.6.3-1.3.5-2 .6.7-.4 1.2-1.1 1.5-1.9-.7.4-1.5.8-2.3.9A3.45 3.45 0 0 0 11.3 9c0 .3 0 .6.1.8A9.8 9.8 0 0 1 4.3 6.2a3.5 3.5 0 0 0 1.1 4.6c-.5 0-1.1-.2-1.5-.4v.1c0 1.7 1.2 3.1 2.8 3.4-.3.1-.7.1-1 .1-.2 0-.5 0-.7-.1.5 1.5 1.8 2.5 3.4 2.5A7 7 0 0 1 4 17.9c-.3 0-.6 0-.9-.1A9.9 9.9 0 0 0 8.5 19c6.5 0 10.1-5.4 10.1-10.1v-.5c.6-.4 1.1-1 1.4-1.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Github({ className }: SocialIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.8a9.2 9.2 0 0 0-2.9 17.9c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 2.9.8.1-.7.4-1.1.7-1.4-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.6 4.9.4.3.7 1 .7 1.9v2.8c0 .3.2.6.7.5A9.2 9.2 0 0 0 12 2.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border bg-surface relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 mix-blend-overlay"></div>

      <div className="mx-auto max-w-7xl px-5 md:px-8 py-20 relative z-10">
        <div className="grid gap-12 md:grid-cols-12">
          {/* Brand & Newsletter Column */}
          <div className="md:col-span-5 pr-8">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <span className="font-display text-2xl font-bold tracking-tight text-foreground">
                PriceLens<span className="text-primary">.</span>
              </span>
            </Link>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed mb-8">
              The intelligent price comparison platform. We monitor over 200+ stores using Machine
              Learning to ensure you never overpay again.
            </p>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-primary" /> Stay ahead of price drops
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Join 80,000+ smart shoppers receiving our weekly top deals.
              </p>
              <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="name@email.com"
                  className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                  required
                />
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Links Columns */}
          <div className="md:col-span-2 md:col-start-7">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground mb-6">
              Platform
            </div>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <Link to="/search" className="hover:text-primary transition-colors">
                  Compare Prices
                </Link>
              </li>
              <li>
                <Link to="/trending" className="hover:text-primary transition-colors">
                  Trending Now
                </Link>
              </li>
              <li>
                <Link to="/deals" className="hover:text-primary transition-colors">
                  Best Deals
                </Link>
              </li>
              <li>
                <Link to="/alerts" className="hover:text-primary transition-colors">
                  Price Alerts
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-primary transition-colors">
                  My Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground mb-6">
              Resources
            </div>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <Link to="/forum" className="hover:text-primary transition-colors">
                  Community Forum
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Extension
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Developer API
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground mb-6">
              Company
            </div>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-20 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row md:items-center">
          <div>© {new Date().getFullYear()} PriceLens Inc. All rights reserved.</div>

          <div className="flex items-center gap-4">
            <a
              href="#"
              aria-label="Twitter"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="#"
              aria-label="Github"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
