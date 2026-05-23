#!/usr/bin/env python3
"""
generate_dataset.py — PriceLens Dataset Generator (Kaggle Edition)

Pulls real e-commerce snapshot datasets from Kaggle using kagglehub,
extracts real products, cleans the data, and generates 90-day simulated
price histories based on real market distributions to train the ML pipeline.
"""

import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import kagglehub

random.seed(42)
np.random.seed(42)

# -----------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------
N_PRODUCTS = 300
HISTORY_DAYS = 90

FESTIVAL_PERIODS = [
    ("10-01", "10-10"),  # Navratri
    ("10-15", "10-25"),  # Dussehra
    ("11-01", "11-15"),  # Diwali
    ("12-20", "01-05"),  # Christmas / New Year
    ("07-15", "07-25"),  # Prime Day / Big Billion Day
]

def is_festival(date: datetime) -> bool:
    for start_str, end_str in FESTIVAL_PERIODS:
        try:
            year = date.year
            s = datetime.strptime(f"{year}-{start_str}", "%Y-%m-%d")
            e = datetime.strptime(f"{year}-{end_str}", "%Y-%m-%d")
            if s <= date <= e:
                return True
        except ValueError:
            pass
    return False

def generate_price_series(base: float, days: int, volatility: float) -> list:
    """Simulate realistic price movements using a mean-reverting random walk."""
    prices = [base]
    for i in range(1, days):
        dt = datetime.today() - timedelta(days=days - i)

        # Mean reversion
        mr = 0.02 * (base - prices[-1])
        # Random shock
        shock = np.random.normal(0, base * volatility * 0.1)
        # Weekend slight discount
        weekend_dip = -base * 0.01 if dt.weekday() >= 5 else 0
        # Festival surge (prices go UP before festival, then crash on sale)
        fest_boost = base * np.random.uniform(0.05, 0.15) if is_festival(dt) else 0

        new_price = prices[-1] + mr + shock + weekend_dip + fest_boost
        # Clamp to ±35% of base
        new_price = max(base * 0.65, min(base * 1.35, new_price))
        prices.append(round(new_price, 2))

    return prices

def clean_price(price_val):
    if pd.isna(price_val): return np.nan
    s = str(price_val).replace(',', '').replace('₹', '').replace('$', '').strip()
    try:
        return float(s)
    except:
        return np.nan

def fetch_kaggle_products():
    """Fetch Kaggle datasets and return a cleaned list of product dictionaries."""
    products = []
    
    # 1. Fetch Amazon Dataset
    print("[1/3] Downloading Amazon Kaggle Dataset...")
    try:
        amz_path = kagglehub.dataset_download("muqaddasejaz/amazon-products-dataset")
        df_amz = pd.read_csv(os.path.join(amz_path, "products.csv"), nrows=2000)
        
        for _, row in df_amz.iterrows():
            price = clean_price(row.get('price'))
            if pd.isna(price) or price <= 0:
                continue
                
            title = str(row.get('title'))[:100]
            rating = clean_price(row.get('rating'))
            rating = min(max(rating, 1.0), 5.0) if not pd.isna(rating) else 4.2
            reviews = clean_price(row.get('reviews'))
            reviews = int(reviews) if not pd.isna(reviews) else random.randint(10, 500)
            
            products.append({
                "title": title,
                "price": price,
                "original_price": round(price * random.uniform(1.1, 1.4), 2),
                "rating": rating,
                "reviews": reviews,
                "category": "General",
                "brand": "Amazon Brand",
                "platform": "Amazon"
            })
    except Exception as e:
        print(f"Warning: Failed to load Amazon dataset: {e}")

    # 2. Fetch Flipkart Dataset
    print("[2/3] Downloading Flipkart Kaggle Dataset...")
    try:
        fk_path = kagglehub.dataset_download("shrikrishnaparab/flipkart-products-dataset")
        fk_dir = os.path.join(fk_path, "flipkart data")
        
        for file in os.listdir(fk_dir):
            if file.endswith('.csv'):
                category_name = file.replace('flipkart_', '').replace('.csv', '').title()
                df_fk = pd.read_csv(os.path.join(fk_dir, file), encoding='latin1', nrows=1000)
                
                # Try to find standard columns in Flipkart dataset
                cols = df_fk.columns.tolist()
                title_col = next((c for c in cols if 'name' in c.lower() or 'title' in c.lower()), None)
                price_col = next((c for c in cols if 'price' in c.lower() and 'discount' not in c.lower()), None)
                
                if title_col and price_col:
                    for _, row in df_fk.iterrows():
                        price = clean_price(row[price_col])
                        if pd.isna(price) or price <= 0:
                            continue
                            
                        products.append({
                            "title": str(row[title_col])[:100],
                            "price": price,
                            "original_price": round(price * random.uniform(1.05, 1.3), 2),
                            "rating": round(random.uniform(3.8, 4.8), 1),
                            "reviews": random.randint(50, 3000),
                            "category": category_name,
                            "brand": "Flipkart Brand",
                            "platform": "Flipkart"
                        })
    except Exception as e:
        print(f"Warning: Failed to load Flipkart dataset: {e}")

    # 3. Fallback if both fail
    if len(products) < N_PRODUCTS:
        print(f"Warning: Only loaded {len(products)} products from Kaggle. Using fallbacks.")
        for i in range(N_PRODUCTS - len(products)):
            price = round(random.uniform(500, 50000), 2)
            products.append({
                "title": f"Fallback Synthetic Product {i}",
                "price": price,
                "original_price": round(price * 1.2, 2),
                "rating": 4.0,
                "reviews": 100,
                "category": "Fallback",
                "brand": "Unknown",
                "platform": "Unknown"
            })
            
    print(f"      Total unique products extracted: {len(products)}")
    return products

def generate_dataset() -> pd.DataFrame:
    records = []
    today = datetime.today()
    
    products = fetch_kaggle_products()
    
    # Shuffle and pick N_PRODUCTS
    random.shuffle(products)
    selected_products = products[:N_PRODUCTS]
    
    print("[3/3] Generating 90-day time-series history...")
    for pid, p in enumerate(selected_products):
        base_price = p["price"]
        mrp = p["original_price"]
        # Determine volatility roughly based on price magnitude
        volatility = 0.15 if base_price < 10000 else 0.08
        
        prices = generate_price_series(base_price, HISTORY_DAYS, volatility)

        for day_idx, price in enumerate(prices):
            date = today - timedelta(days=HISTORY_DAYS - day_idx - 1)
            records.append({
                "product_id":       f"PROD_{pid:04d}",
                "product_name":     p["title"],
                "category":         p["category"],
                "brand":            p["brand"],
                "platform":         p["platform"],
                "date":             date.strftime("%Y-%m-%d"),
                "price":            price,
                "mrp":              mrp,
                "rating":           p["rating"],
                "review_count":     p["reviews"],
                "discount_pct":     round((mrp - price) / mrp * 100, 2) if mrp > 0 else 0,
                "day_of_week":      date.weekday(),
                "day_of_month":     date.day,
                "month":            date.month,
                "is_weekend":       int(date.weekday() >= 5),
                "is_festival":      int(is_festival(date)),
            })

    return pd.DataFrame(records)

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    df = generate_dataset()
    df.to_csv("data/price_history.csv", index=False)
    print(f"\n[OK] Kaggle Dataset Generation Complete:")
    print(f"     Rows        : {len(df):,}")
    print(f"     Products    : {df['product_id'].nunique()}")
    print(f"     Date range  : {df['date'].min()} -> {df['date'].max()}")
    print("\nSample:")
    print(df.head(3).to_string(index=False))
