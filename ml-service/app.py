"""
app.py — PriceLens ML Service  (Production Flask API)

Endpoints:
  GET  /health             — Liveness + model status
  POST /predict            — Price forecast (7-day ahead)
  POST /recommend          — Buy / Wait / Watch signal
  POST /batch-predict      — Predict multiple products in one call
  GET  /model/report       — Evaluation metrics from last training run
  POST /scrape/flipkart    — Playwright-based Flipkart scraper
"""

from __future__ import annotations

import json
import logging
import os
import time
from functools import wraps

import asyncio
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from models.price_predictor import PricePredictor
from models.trend_analyzer import TrendAnalyzer
from scrapers.flipkart_scraper import scrape_flipkart_async

# ── Bootstrap ────────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Read allowed origins from env — defaults to localhost for dev
_allowed_origins = os.getenv("CLIENT_URL", "http://localhost:5173")
CORS(app, resources={r"/*": {"origins": _allowed_origins}}, supports_credentials=True)

# Singletons — loaded once at startup
predictor = PricePredictor()
analyzer  = TrendAnalyzer()

REPORT_PATH = os.path.join(os.path.dirname(__file__), "models", "evaluation_report.json")

# ── Decorators ────────────────────────────────────────────────────────────────

def require_json(fn):
    """Return 400 if the request body is missing or not valid JSON."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "JSON body required"}), 400
        return fn(*args, **kwargs)
    return wrapper


def timed(fn):
    """Inject request duration into every JSON response."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        t0       = time.perf_counter()
        response = fn(*args, **kwargs)
        elapsed  = round((time.perf_counter() - t0) * 1000, 1)

        # Patch the response body if it's a plain dict
        if isinstance(response, tuple):
            body, status = response
        else:
            body, status = response, 200

        if hasattr(body, "get_json"):
            data = body.get_json()
            if isinstance(data, dict):
                data["_ms"] = elapsed
                return jsonify(data), status

        return response
    return wrapper


# ── Health ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Liveness probe — returns model readiness status."""
    return jsonify({
        "status":        "ok",
        "service":       "pricelens-ml",
        "version":       "2.0.0",
        "model_trained": predictor.is_trained,
    })


# ── Predict ───────────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
@require_json
@timed
def predict():
    """
    Predict future price for a single product.

    Request:
    {
        "product_id":   "string",
        "history":      [{"date": "YYYY-MM-DD", "price": float}, ...],
        "days_ahead":   int          (optional, default 7),
        "mrp":          float        (optional),
        "category":     "string"     (optional),
        "platform":     "string"     (optional),
        "rating":       float        (optional),
        "review_count": int          (optional)
    }

    Response:
    {
        "product_id":     "string",
        "predicted_price": float,
        "confidence":      float,
        "price_range":    {"low": float, "high": float},
        "trend":          "rising|falling|stable|unknown",
        "recommendation": "BUY_NOW|WAIT|WATCH",
        "reason":         "string",
        "days_ahead":     int,
        "method":         "string",
        "_ms":            float  (response time)
    }
    """
    data = request.get_json()

    product_id   = data.get("product_id", "unknown")
    history      = data.get("history", [])
    days_ahead   = int(data.get("days_ahead", 7))
    mrp          = data.get("mrp")
    category     = data.get("category", "Electronics")
    platform     = data.get("platform", "Amazon")
    rating       = float(data.get("rating", 4.0))
    review_count = int(data.get("review_count", 500))

    if len(history) < 3:
        return jsonify({
            "product_id":    product_id,
            "predicted_price": None,
            "confidence":    0.0,
            "trend":         "unknown",
            "recommendation": "INSUFFICIENT_DATA",
            "reason":        "Minimum 3 historical data points required.",
            "days_ahead":    days_ahead,
        }), 200

    try:
        pred   = predictor.predict(
            history, days_ahead=days_ahead,
            mrp=mrp, rating=rating, review_count=review_count,
            category=category, platform=platform,
        )
        trend  = analyzer.analyze(history)
        rec    = _make_recommendation(
            current_price   = pred.get("current_price") or history[-1]["price"],
            predicted_price = pred.get("predicted_price"),
            trend_name      = trend.get("trend", "stable"),
        )

        return jsonify({
            "product_id": product_id,
            **pred,
            "trend":          trend.get("trend"),
            "trend_details":  trend,
            **rec,
        })

    except Exception as exc:
        logger.exception("Prediction error for product %s", product_id)
        return jsonify({"error": "Prediction failed", "detail": str(exc)}), 500


# ── Batch Predict ─────────────────────────────────────────────────────────────

@app.route("/batch-predict", methods=["POST"])
@require_json
@timed
def batch_predict():
    """
    Predict prices for multiple products in a single call.

    Request:  { "products": [ <predict-request>, ... ] }
    Response: { "results":  [ <predict-response>, ... ] }
    """
    data     = request.get_json()
    products = data.get("products", [])

    if not products:
        return jsonify({"error": "'products' list is required"}), 400

    if len(products) > 50:
        return jsonify({"error": "Maximum 50 products per batch"}), 400

    results = []
    for item in products:
        try:
            history    = item.get("history", [])
            days_ahead = int(item.get("days_ahead", 7))

            if len(history) < 3:
                results.append({"product_id": item.get("product_id"), "error": "INSUFFICIENT_DATA"})
                continue

            pred  = predictor.predict(history, days_ahead=days_ahead,
                                      category=item.get("category", "Electronics"),
                                      platform=item.get("platform", "Amazon"))
            trend = analyzer.analyze(history)
            rec   = _make_recommendation(
                current_price   = pred.get("current_price") or history[-1]["price"],
                predicted_price = pred.get("predicted_price"),
                trend_name      = trend.get("trend", "stable"),
            )
            results.append({"product_id": item.get("product_id"), **pred, "trend": trend.get("trend"), **rec})

        except Exception as exc:
            results.append({"product_id": item.get("product_id"), "error": str(exc)})

    return jsonify({"results": results, "count": len(results)})


# ── Recommend ─────────────────────────────────────────────────────────────────

@app.route("/recommend", methods=["POST"])
@require_json
@timed
def recommend():
    """
    Generate a standalone buy/wait recommendation.

    Request:  { "current_price": float, "predicted_price": float, "trend": string }
    Response: { "recommendation": string, "reason": string, "confidence": float, ... }
    """
    data = request.get_json()

    current_price   = float(data.get("current_price", 0))
    predicted_price = data.get("predicted_price")
    trend           = data.get("trend", "stable")

    if predicted_price is None or current_price == 0:
        return jsonify({
            "recommendation": "WATCH",
            "reason":         "Insufficient data to make a recommendation.",
            "confidence":     0.0,
            "savings_potential": 0.0,
        })

    result = _make_recommendation(current_price, float(predicted_price), trend)
    return jsonify({**result, "current_price": current_price, "predicted_price": float(predicted_price)})


# ── Model Report ──────────────────────────────────────────────────────────────

@app.route("/model/report", methods=["GET"])
def model_report():
    """Return the last training evaluation report."""
    if not os.path.exists(REPORT_PATH):
        return jsonify({
            "error": "No evaluation report found. Run `python train_model.py` first."
        }), 404

    with open(REPORT_PATH) as f:
        report = json.load(f)

    return jsonify(report)


# ── Flipkart Scraper ──────────────────────────────────────────────────────────

@app.route("/scrape/flipkart", methods=["POST"])
@require_json
def flipkart_scrape():
    """Playwright-backed Flipkart scraper."""
    data  = request.get_json()
    query = data.get("query")

    if not query:
        return jsonify({"error": "Search query is required"}), 400

    pages   = min(int(data.get("pages", 2)), 5)
    logger.info("Flipkart scrape: query=%r pages=%d", query, pages)

    try:
        # Bug 15 fix: asyncio.run() raises RuntimeError if there is already a running
        # event loop in the calling thread (e.g. under async gunicorn/anyio workers).
        # Use the safe pattern: get-or-create the loop and call run_until_complete.
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                raise RuntimeError("Loop is closed")
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        if loop.is_running():
            # Already inside an async context — schedule as a task
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(asyncio.run, scrape_flipkart_async(query, pages=pages))
                results = future.result(timeout=120)
        else:
            results = loop.run_until_complete(scrape_flipkart_async(query, pages=pages))

        return jsonify({"success": True, "query": query, "count": len(results), "results": results})
    except Exception as exc:
        logger.exception("Flipkart scrape failed")
        return jsonify({"error": "Scraping failed", "detail": str(exc)}), 500


# ── Shared Logic ──────────────────────────────────────────────────────────────

def _make_recommendation(current_price: float, predicted_price: float, trend_name: str) -> dict:
    """Deterministic rule-based BUY / WAIT / WATCH signal."""
    pct_diff         = ((current_price - predicted_price) / max(current_price, 1)) * 100
    savings_potential = round(current_price - predicted_price, 2)

    if trend_name == "falling" and pct_diff > 5:
        recommendation = "WAIT"
        reason         = f"Price is trending down ~{abs(pct_diff):.1f}%. Expected saving: ₹{abs(savings_potential):,.0f} in 7 days."
        confidence     = min(0.90, 0.55 + abs(pct_diff) / 100)
    elif trend_name == "rising" and pct_diff < -3:
        recommendation = "BUY_NOW"
        reason         = f"Price is rising. Buy before it climbs ~{abs(pct_diff):.1f}% further."
        confidence     = min(0.90, 0.65 + abs(pct_diff) / 100)
    elif trend_name == "stable":
        recommendation = "BUY_NOW"
        reason         = "Price is stable — a good time to buy."
        confidence     = 0.72
    else:
        recommendation = "WATCH"
        reason         = "Price movement is uncertain. Monitor for a few more days."
        confidence     = 0.42

    return {
        "recommendation":  recommendation,
        "reason":          reason,
        "confidence":      round(confidence, 2),
        "savings_potential": savings_potential,
        "price_change_pct": round(pct_diff, 2),
    }


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.getenv("PORT", 8000))
    debug = os.getenv("FLASK_ENV", "production") == "development"
    logger.info("PriceLens ML Service v2.0 starting on http://localhost:%d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
