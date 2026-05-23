<<<<<<< HEAD
# 🧠 Intelligent E-Commerce Price Comparison & Prediction Platform

> A professional, full-stack SaaS-grade price comparison platform powered by React, Node.js, Flask ML, and MongoDB. Compares real Amazon and eBay prices, tracks history, predicts future prices with machine learning, and sends email alerts.

---

## 🏗️ Architecture

```
client/        → React + Vite + Tailwind CSS (Port 5173)
server/        → Node.js + Express REST API (Port 5000)
ml-service/    → Python Flask ML Microservice (Port 8000)
```

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB (local or Atlas)

### 2. Server
```bash
cd server
npm install
# Edit .env with your credentials
npm run dev
```

### 3. Client
```bash
cd client
npm install
npm run dev
```

### 4. ML Service
```bash
cd ml-service
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python app.py
```

---

## 🔑 Environment Setup

Copy `.env.example` to `.env` in `server/` and fill in:
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — Any long random string
- `RAPIDAPI_KEY` — Your RapidAPI key (already set if provided)
- `EMAIL_USER` / `EMAIL_PASS` — Gmail + App Password for alerts

---

## 📋 Features

| Feature | Status |
|---------|--------|
| Real Amazon product search (RapidAPI) | ✅ |
| eBay scraping (cheerio) | ✅ |
| Product price history tracking | ✅ |
| ML price prediction (RandomForest) | ✅ |
| Price-drop email alerts | ✅ |
| JWT Authentication | ✅ |
| User Dashboard + Watchlist | ✅ |
| Admin Dashboard | ✅ |
| Community Forum | ✅ |
| Dark/Light mode | ✅ |
| Cron jobs (6h refresh) | ✅ |

---

## 🌐 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/products/search?q=` | Search products |
| GET | `/api/products/:id` | Product + history |
| GET | `/api/products/:id/compare` | Platform comparison |
| GET | `/api/products/:id/predict` | ML prediction |
| POST | `/api/alerts` | Set price alert |
| GET | `/api/forum` | Forum posts |
| GET | `/api/admin/stats` | Admin stats |

---

## 🤖 ML Service Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/predict` | Price prediction |
| POST | `/recommend` | Buy/Wait recommendation |
| GET | `/health` | Service health |
=======
# Mini-project
>>>>>>> 57ff57cb72aa3b48ae29bc259eded42eb3a82315
