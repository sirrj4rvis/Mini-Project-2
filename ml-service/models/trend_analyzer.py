"""
Trend Analyzer

Analyzes historical price data to detect:
- Overall trend direction (rising/falling/stable)
- Volatility score
- Price momentum
- Seasonal patterns
"""

import numpy as np
import pandas as pd
from typing import List, Dict


class TrendAnalyzer:
    """Statistical trend analysis for price time series."""

    def analyze(self, history: List[Dict]) -> Dict:
        """
        Analyze price history and return trend metadata.

        Args:
            history: [{"date": "YYYY-MM-DD", "price": float}, ...]

        Returns:
            dict with trend, volatility, momentum, analysis details
        """
        if len(history) < 2:
            return {"trend": "unknown", "volatility": 0, "momentum": 0, "summary": "Insufficient data"}

        df = pd.DataFrame(history)
        df['price'] = pd.to_numeric(df['price'], errors='coerce').dropna()
        prices = df['price'].values

        # ── Linear regression slope (trend direction) ──────────────────────
        x = np.arange(len(prices))
        slope, intercept = np.polyfit(x, prices, 1)
        slope_pct = (slope / np.mean(prices)) * 100  # % change per day

        # ── Volatility (coefficient of variation) ──────────────────────────
        volatility = float(np.std(prices) / np.mean(prices) * 100) if np.mean(prices) > 0 else 0

        # ── Momentum (short-term vs long-term average) ─────────────────────
        if len(prices) >= 7:
            short_avg = np.mean(prices[-3:])
            long_avg = np.mean(prices[-7:])
            momentum = ((short_avg - long_avg) / long_avg) * 100
        else:
            momentum = slope_pct

        # ── Classify trend ─────────────────────────────────────────────────
        if slope_pct > 0.5:
            trend = "rising"
        elif slope_pct < -0.5:
            trend = "falling"
        else:
            trend = "stable"

        # ── Price range stats ───────────────────────────────────────────────
        price_min = float(np.min(prices))
        price_max = float(np.max(prices))
        price_current = float(prices[-1])
        price_avg = float(np.mean(prices))
        total_change_pct = float(((price_current - prices[0]) / prices[0]) * 100) if prices[0] > 0 else 0

        return {
            "trend": trend,
            "slope_per_day": round(float(slope), 4),
            "slope_pct_per_day": round(slope_pct, 4),
            "volatility": round(volatility, 2),
            "momentum": round(float(momentum), 2),
            "price_min": price_min,
            "price_max": price_max,
            "price_avg": round(price_avg, 2),
            "price_current": price_current,
            "total_change_pct": round(total_change_pct, 2),
            "data_points": len(prices),
            "summary": self._generate_summary(trend, slope_pct, volatility, total_change_pct)
        }

    def _generate_summary(self, trend: str, slope_pct: float, volatility: float, total_change: float) -> str:
        """Generate a human-readable summary of the trend."""
        if trend == "rising":
            return f"Price is rising by ~{abs(slope_pct):.2f}% per day. Total increase: {abs(total_change):.1f}%."
        elif trend == "falling":
            return f"Price is falling by ~{abs(slope_pct):.2f}% per day. Total decrease: {abs(total_change):.1f}%."
        else:
            return f"Price is stable. Volatility is {volatility:.1f}%."
