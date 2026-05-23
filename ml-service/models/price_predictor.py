"""
models/price_predictor.py — PriceLens Production Price Predictor

Wraps the trained sklearn Pipeline for inference. Loads the
pre-trained primary_pipeline.pkl on startup and exposes a clean
.predict() interface consumed by the Flask app.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any

import joblib
import numpy as np
import pandas as pd

# ── Artifact paths ──────────────────────────────────────────────────────────
_DIR          = os.path.dirname(__file__)
PRIMARY_PKL   = os.path.join(_DIR, "primary_pipeline.pkl")
RF_PKL        = os.path.join(_DIR, "randomforest_pipeline.pkl")
LR_PKL        = os.path.join(_DIR, "linearregression_pipeline.pkl")
LE_CAT_PKL    = os.path.join(_DIR, "le_category.pkl")
LE_PLAT_PKL   = os.path.join(_DIR, "le_platform.pkl")
REPORT_JSON   = os.path.join(_DIR, "evaluation_report.json")

# ── Feature contract (must match train_model.py) ────────────────────────────
FEATURE_COLS = [
    "day_of_week", "day_of_month", "month", "is_weekend", "is_festival",
    "days_since_start",
    "price_lag_1", "price_lag_3", "price_lag_7", "price_lag_14",
    "rolling_mean_7", "rolling_mean_14", "rolling_mean_30",
    "rolling_std_7", "rolling_min_7", "rolling_max_7",
    "price_momentum", "price_acceleration",
    "mrp", "rating", "review_count",
    "category_enc", "platform_enc",
]

FESTIVAL_WINDOWS = [
    ("10-01", "10-10"), ("10-15", "10-25"),
    ("11-01", "11-15"), ("12-20", "01-05"),
    ("07-15", "07-25"),
]


def _is_festival(date: datetime) -> int:
    for s_str, e_str in FESTIVAL_WINDOWS:
        try:
            s = datetime.strptime(f"{date.year}-{s_str}", "%Y-%m-%d")
            e = datetime.strptime(f"{date.year}-{e_str}", "%Y-%m-%d")
            if s <= date <= e:
                return 1
        except ValueError:
            pass
    return 0


class PricePredictor:
    """Production-grade price predictor backed by trained sklearn Pipelines."""

    def __init__(self):
        self.primary:   Any   = None
        self.lr_model:  Any   = None
        self.le_cat:    Any   = None
        self.le_plat:   Any   = None
        self.is_trained: bool = False
        self._load()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def _load(self):
        """Load all serialized artifacts from disk."""
        try:
            if os.path.exists(PRIMARY_PKL):
                self.primary  = joblib.load(PRIMARY_PKL)
                self.is_trained = True
                print("[PricePredictor] ✅  Primary pipeline loaded.")

            if os.path.exists(LR_PKL):
                self.lr_model = joblib.load(LR_PKL)

            if os.path.exists(LE_CAT_PKL):
                self.le_cat  = joblib.load(LE_CAT_PKL)

            if os.path.exists(LE_PLAT_PKL):
                self.le_plat = joblib.load(LE_PLAT_PKL)

        except Exception as exc:
            print(f"[PricePredictor] ⚠  Could not load artifacts: {exc}")
            print("[PricePredictor]    Run `python train_model.py` first.")

    # ── Feature Engineering ───────────────────────────────────────────────────

    def _build_df(self, history: list) -> pd.DataFrame:
        """Convert raw history list to a feature-rich DataFrame."""
        df = pd.DataFrame(history)
        df["date"]  = pd.to_datetime(df["date"])
        df["price"] = pd.to_numeric(df["price"], errors="coerce")
        df = df.sort_values("date").reset_index(drop=True)
        df = df.dropna(subset=["price"])
        return df

    def _build_future_row(self, df: pd.DataFrame, days_ahead: int,
                           mrp: float, rating: float,
                           review_count: int, category: str,
                           platform: str) -> pd.DataFrame:
        """Build a single-row feature vector for the future prediction date."""
        last_date   = df["date"].iloc[-1]
        future_date = last_date + timedelta(days=days_ahead)
        prices      = df["price"].values

        # Encode categories — fall back to 0 if unseen label
        cat_enc  = 0
        plat_enc = 0
        if self.le_cat is not None:
            try:
                cat_enc = int(self.le_cat.transform([category])[0])
            except ValueError:
                pass
        if self.le_plat is not None:
            try:
                plat_enc = int(self.le_plat.transform([platform])[0])
            except ValueError:
                pass

        def lag(n):
            return float(prices[-n]) if len(prices) >= n else float(prices[0])

        def roll_stat(fn, w):
            tail = prices[-w:] if len(prices) >= w else prices
            return float(fn(tail))

        pct_chg = np.diff(prices) / np.clip(prices[:-1], 1, None)
        momentum     = float(pct_chg[-1])  if len(pct_chg) >= 1 else 0.0
        acceleration = float(pct_chg[-1] - pct_chg[-2]) if len(pct_chg) >= 2 else 0.0

        row = {
            "day_of_week":      future_date.dayofweek,
            "day_of_month":     future_date.day,
            "month":            future_date.month,
            "is_weekend":       int(future_date.weekday() >= 5),
            "is_festival":      _is_festival(future_date),
            "days_since_start": (future_date - df["date"].iloc[0]).days,
            "price_lag_1":      lag(1),
            "price_lag_3":      lag(3),
            "price_lag_7":      lag(7),
            "price_lag_14":     lag(14),
            "rolling_mean_7":   roll_stat(np.mean, 7),
            "rolling_mean_14":  roll_stat(np.mean, 14),
            "rolling_mean_30":  roll_stat(np.mean, 30),
            "rolling_std_7":    roll_stat(np.std,  7),
            "rolling_min_7":    roll_stat(np.min,  7),
            "rolling_max_7":    roll_stat(np.max,  7),
            "price_momentum":   momentum,
            "price_acceleration": acceleration,
            "mrp":              float(mrp),
            "rating":           float(rating),
            "review_count":     int(review_count),
            "category_enc":     cat_enc,
            "platform_enc":     plat_enc,
        }

        return pd.DataFrame([row])[FEATURE_COLS]

    # ── Public Interface ──────────────────────────────────────────────────────

    def predict(
        self,
        history:      list,
        days_ahead:   int   = 7,
        mrp:          float = None,
        rating:       float = 4.0,
        review_count: int   = 500,
        category:     str   = "Electronics",
        platform:     str   = "Amazon",
    ) -> dict:
        """
        Predict price N days from now.

        Args:
            history:      [{"date": "YYYY-MM-DD", "price": float}, ...]
            days_ahead:   Forecast horizon in days (default 7)
            mrp:          Maximum Retail Price (optional; defaults to 1.3× last price)
            rating:       Product rating (default 4.0)
            review_count: Review count (default 500)
            category:     Product category string
            platform:     E-commerce platform string

        Returns:
            Prediction dict with price, confidence, range, method
        """
        df = self._build_df(history)

        if len(df) < 3:
            return {
                "predicted_price": None,
                "confidence":      0.0,
                "trend":           "unknown",
                "recommendation":  "INSUFFICIENT_DATA",
                "reason":          "Need at least 3 data points.",
                "days_ahead":      days_ahead,
                "method":          "none",
            }

        current_price = float(df["price"].iloc[-1])
        mrp = mrp or round(current_price * 1.3, 2)

        # ── Fallback: linear extrapolation if no trained model ───────────────
        if not self.is_trained or self.primary is None:
            pct_changes = df["price"].pct_change().dropna().values
            avg_drift   = float(np.mean(pct_changes)) if len(pct_changes) > 0 else 0.0
            predicted   = round(current_price * (1 + avg_drift * days_ahead), 2)
            return {
                "predicted_price": max(0.0, predicted),
                "confidence":      0.30,
                "price_range":     {"low": round(predicted * 0.95, 2), "high": round(predicted * 1.05, 2)},
                "days_ahead":      days_ahead,
                "method":          "linear_extrapolation",
            }

        # ── Full ML inference ────────────────────────────────────────────────
        X_future = self._build_future_row(
            df, days_ahead, mrp, rating, review_count, category, platform
        )

        primary_pred = float(self.primary.predict(X_future)[0])

        # Ensemble with LR if available (80/20 weighted)
        if self.lr_model is not None:
            lr_pred      = float(self.lr_model.predict(X_future)[0])
            predicted    = round(0.80 * primary_pred + 0.20 * lr_pred, 2)
        else:
            predicted    = round(primary_pred, 2)

        predicted = max(0.0, predicted)

        # ── Confidence scoring ───────────────────────────────────────────────
        std_dev         = float(df["price"].std()) if len(df) > 1 else current_price * 0.05
        data_confidence = min(1.0, len(df) / 30.0)
        price_stability = max(0.0, 1.0 - std_dev / max(current_price, 1))
        confidence      = round(min(0.95, data_confidence * price_stability * 0.90 + 0.10), 2)

        return {
            "predicted_price": predicted,
            "confidence":      confidence,
            "price_range": {
                "low":  round(max(0, predicted - std_dev), 2),
                "high": round(predicted + std_dev, 2),
            },
            "current_price": current_price,
            "days_ahead":    days_ahead,
            "method":        "ml_ensemble",
        }
