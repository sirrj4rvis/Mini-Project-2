#!/usr/bin/env python3
"""
train_model.py — PriceLens ML Training Pipeline

Trains two models on the historical price dataset:
  1. Linear Regression  (fast, interpretable baseline)
  2. Random Forest      (primary production model)

Pipeline stages:
  [1] Load & validate dataset
  [2] Feature engineering (temporal + lag + rolling + category encoding)
  [3] Train / Test split (time-series aware — no data leakage)
  [4] Train both models
  [5] Evaluate: MAE, RMSE, R², MAPE
  [6] Save winner model + scaler + report via joblib

Usage:
  python train_model.py [--data data/price_history.csv] [--out models/]
"""

import argparse
import json
import os
import warnings
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(__file__)
DATA_PATH  = os.path.join(BASE_DIR, "data", "price_history.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Feature Engineering
# ─────────────────────────────────────────────────────────────────────────────
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

TARGET_COL = "price"


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Full feature engineering pipeline for the price dataset."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["product_id", "date"]).reset_index(drop=True)

    # ── Temporal features ──────────────────────────────────────────────────
    df["day_of_week"]   = df["date"].dt.dayofweek
    df["day_of_month"]  = df["date"].dt.day
    df["month"]         = df["date"].dt.month
    df["is_weekend"]    = (df["day_of_week"] >= 5).astype(int)

    grp = df.groupby("product_id")
    df["days_since_start"] = grp["date"].transform(lambda x: (x - x.min()).dt.days)

    # ── Lag features (per product to prevent cross-product leakage) ─────────
    df["price_lag_1"]  = grp["price"].shift(1)
    df["price_lag_3"]  = grp["price"].shift(3)
    df["price_lag_7"]  = grp["price"].shift(7)
    df["price_lag_14"] = grp["price"].shift(14)

    # ── Rolling statistics ──────────────────────────────────────────────────
    df["rolling_mean_7"]  = grp["price"].transform(lambda x: x.rolling(7,  min_periods=1).mean())
    df["rolling_mean_14"] = grp["price"].transform(lambda x: x.rolling(14, min_periods=1).mean())
    df["rolling_mean_30"] = grp["price"].transform(lambda x: x.rolling(30, min_periods=1).mean())
    df["rolling_std_7"]   = grp["price"].transform(lambda x: x.rolling(7,  min_periods=1).std()).fillna(0)
    df["rolling_min_7"]   = grp["price"].transform(lambda x: x.rolling(7,  min_periods=1).min())
    df["rolling_max_7"]   = grp["price"].transform(lambda x: x.rolling(7,  min_periods=1).max())

    # ── Price momentum & acceleration ───────────────────────────────────────
    pct_chg = grp["price"].pct_change().fillna(0)
    df["price_momentum"]     = pct_chg
    df["price_acceleration"] = pct_chg.diff().fillna(0)

    # ── Categorical encoding ─────────────────────────────────────────────────
    le_cat  = LabelEncoder()
    le_plat = LabelEncoder()
    df["category_enc"] = le_cat.fit_transform(df["category"].astype(str))
    df["platform_enc"] = le_plat.fit_transform(df["platform"].astype(str))

    # Save encoders for inference
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(le_cat,  os.path.join(MODELS_DIR, "le_category.pkl"))
    joblib.dump(le_plat, os.path.join(MODELS_DIR, "le_platform.pkl"))

    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])
    return df, le_cat, le_plat


# ─────────────────────────────────────────────────────────────────────────────
# 2. Train / Test Split  (time-series aware — last 14 days = test)
# ─────────────────────────────────────────────────────────────────────────────
def time_series_split(df: pd.DataFrame):
    max_date = df["date"].max()
    split_date = max_date - pd.Timedelta(days=14)

    train = df[df["date"] <= split_date]
    test  = df[df["date"] >  split_date]

    print(f"\n{'─'*60}")
    print(f"  Train set: {len(train):,} rows  ({train['date'].min().date()} → {split_date.date()})")
    print(f"  Test  set: {len(test):,}  rows  ({(split_date + pd.Timedelta(days=1)).date()} → {max_date.date()})")
    print(f"{'─'*60}\n")

    return (
        train[FEATURE_COLS], train[TARGET_COL],
        test[FEATURE_COLS],  test[TARGET_COL],
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. Evaluation Metrics
# ─────────────────────────────────────────────────────────────────────────────
def evaluate(name: str, y_true, y_pred) -> dict:
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / np.clip(y_true, 1, None))) * 100

    print(f"  [{name}]")
    print(f"    MAE   : ₹{mae:,.2f}")
    print(f"    RMSE  : ₹{rmse:,.2f}")
    print(f"    R²    : {r2:.4f}")
    print(f"    MAPE  : {mape:.2f}%")
    return {"name": name, "mae": round(mae, 2), "rmse": round(rmse, 2), "r2": round(r2, 4), "mape": round(mape, 2)}


# ─────────────────────────────────────────────────────────────────────────────
# 4. Models
# ─────────────────────────────────────────────────────────────────────────────
def build_pipelines():
    return {
        "LinearRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  LinearRegression()),
        ]),
        "Ridge": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  Ridge(alpha=1.0)),
        ]),
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  RandomForestRegressor(
                n_estimators=200,
                max_depth=12,
                min_samples_split=4,
                min_samples_leaf=2,
                max_features="sqrt",
                n_jobs=-1,
                random_state=42,
            )),
        ]),
        "GradientBoosting": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  GradientBoostingRegressor(
                n_estimators=200,
                learning_rate=0.05,
                max_depth=6,
                subsample=0.8,
                random_state=42,
            )),
        ]),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Main Training Loop
# ─────────────────────────────────────────────────────────────────────────────
def train(data_path: str = DATA_PATH):
    print("\n" + "═"*60)
    print("  PriceLens ML Training Pipeline")
    print("  Started:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("═"*60)

    # Load
    print(f"\n[1/4] Loading dataset from: {data_path}")
    df = pd.read_csv(data_path)
    print(f"      Rows: {len(df):,}  |  Columns: {len(df.columns)}")
    print(f"      Price range: ₹{df['price'].min():,.0f} → ₹{df['price'].max():,.0f}")
    print(f"      Unique products: {df['product_id'].nunique()}")

    # Feature Engineering
    print("\n[2/4] Engineering features...")
    df, le_cat, le_plat = engineer_features(df)
    print(f"      Feature matrix: {len(df):,} rows × {len(FEATURE_COLS)} features")

    # Split
    print("\n[3/4] Splitting dataset (time-series aware)...")
    X_train, y_train, X_test, y_test = time_series_split(df)

    # Train & Evaluate
    print("[4/4] Training models...\n")
    pipelines = build_pipelines()
    results   = []
    trained   = {}

    for name, pipe in pipelines.items():
        print(f"  ▶  Training {name}...")
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)
        metrics = evaluate(name, y_test.values, y_pred)
        results.append(metrics)
        trained[name] = pipe
        print()

    # Select winner by RMSE
    results_sorted = sorted(results, key=lambda x: x["rmse"])
    winner_name = results_sorted[0]["name"]
    print(f"\n{'═'*60}")
    print(f"  🏆  Best Model: {winner_name}  (RMSE ₹{results_sorted[0]['rmse']:,.2f})")
    print("═"*60)

    # Save all artifacts
    os.makedirs(MODELS_DIR, exist_ok=True)

    for name, pipe in trained.items():
        slug = name.lower().replace(" ", "_")
        joblib.dump(pipe, os.path.join(MODELS_DIR, f"{slug}_pipeline.pkl"))
        print(f"  💾 Saved {slug}_pipeline.pkl")

    # Save the winner as the primary model used by Flask
    joblib.dump(trained[winner_name], os.path.join(MODELS_DIR, "primary_pipeline.pkl"))
    print(f"  💾 Saved primary_pipeline.pkl  ← used by Flask API")

    # Save evaluation report
    report = {
        "trained_at":   datetime.now().isoformat(),
        "dataset_rows": len(df),
        "features":     FEATURE_COLS,
        "models":       results_sorted,
        "winner":       winner_name,
        "train_size":   len(X_train),
        "test_size":    len(X_test),
    }
    report_path = os.path.join(MODELS_DIR, "evaluation_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"  📊 Saved evaluation_report.json\n")

    print("  ✅  Training complete.\n")
    return report


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PriceLens Model Trainer")
    parser.add_argument("--data", default=DATA_PATH, help="Path to CSV dataset")
    args = parser.parse_args()
    train(data_path=args.data)
