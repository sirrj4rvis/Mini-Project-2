export type Source = "Amazon" | "Flipkart" | "Croma" | "Reliance" | "Myntra";

export interface Offer {
  source: Source;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  shipping: string;
  inStock: boolean;
  link: string;
}

export type RecommendationBadge =
  | "Best Value"
  | "Budget Pick"
  | "Premium Pick"
  | "Most Popular"
  | "Lowest Price Today";

export interface Product {
  id: string;
  title: string;
  canonicalTitle?: string;
  dealScore?: number;
  recommendationBadge?: RecommendationBadge;
  recommendationAction?: "BUY_NOW" | "WAIT";
  recommendationReason?: string;
  recommendationConfidence?: number;
  brand: string;
  category: string;
  image: string;
  bestPrice: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  offers: Offer[];
  history: { date: string; price: number }[];
  prediction: { date: string; price: number }[];
  recommendation: "BUY_NOW" | "WAIT";
  predictionConfidence: number;
  specs?: Record<string, string>;
}

const days = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(5, 10);
};
const future = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(5, 10);
};

const genHistory = (base: number, volatility = 0.08) =>
  Array.from({ length: 60 }, (_, i) => ({
    date: days(60 - i),
    price: Math.round(base * (1 + Math.sin(i / 7) * volatility + (Math.random() - 0.5) * 0.04)),
  }));

const genPrediction = (base: number, trend: number) =>
  Array.from({ length: 14 }, (_, i) => ({
    date: future(i + 1),
    price: Math.round(base * (1 + trend * (i / 14))),
  }));

export const products: Product[] = [
  {
    id: "sony-wh1000xm5",
    title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    canonicalTitle: "Sony WH-1000XM5 (Black)",
    dealScore: 92.5,
    recommendationBadge: "Best Value",
    recommendationAction: "BUY_NOW",
    recommendationReason: "Price is at a 14-day absolute low.",
    recommendationConfidence: 95,
    brand: "Sony",
    category: "Audio",
    image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80",
    bestPrice: 24990,
    originalPrice: 34990,
    rating: 4.7,
    reviews: 12842,
    recommendation: "BUY_NOW",
    predictionConfidence: 87,
    offers: [
      {
        source: "Amazon",
        price: 24990,
        originalPrice: 34990,
        rating: 4.7,
        reviews: 8200,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Flipkart",
        price: 25499,
        originalPrice: 34990,
        rating: 4.6,
        reviews: 3100,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Croma",
        price: 26990,
        originalPrice: 34990,
        rating: 4.5,
        reviews: 942,
        shipping: "₹49",
        inStock: true,
        link: "#",
      },
      {
        source: "Reliance",
        price: 27499,
        originalPrice: 34990,
        rating: 4.5,
        reviews: 600,
        shipping: "Free",
        inStock: false,
        link: "#",
      },
    ],
    history: genHistory(28000, 0.1),
    prediction: genPrediction(24990, 0.04),
  },
  {
    id: "iphone-15-pro",
    title: "Apple iPhone 15 Pro 256GB Natural Titanium",
    canonicalTitle: "Apple iPhone 15 Pro 256GB",
    dealScore: 78.4,
    recommendationBadge: "Premium Pick",
    recommendationAction: "WAIT",
    recommendationReason: "Price is slightly above 14-day average. Wait for a drop.",
    recommendationConfidence: 72,
    brand: "Apple",
    category: "Smartphones",
    image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&q=80",
    bestPrice: 124900,
    originalPrice: 134900,
    rating: 4.8,
    reviews: 5421,
    recommendation: "WAIT",
    predictionConfidence: 76,
    offers: [
      {
        source: "Amazon",
        price: 125900,
        originalPrice: 134900,
        rating: 4.8,
        reviews: 3200,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Flipkart",
        price: 124900,
        originalPrice: 134900,
        rating: 4.8,
        reviews: 1800,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Croma",
        price: 129900,
        originalPrice: 134900,
        rating: 4.7,
        reviews: 320,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
    ],
    history: genHistory(130000, 0.05),
    prediction: genPrediction(124900, -0.05),
  },
  {
    id: "macbook-air-m3",
    title: 'Apple MacBook Air 13" M3 8GB 256GB',
    dealScore: 85.1,
    recommendationBadge: "Most Popular",
    recommendationAction: "BUY_NOW",
    recommendationReason: "Price is 9.2% below the 14-day average.",
    recommendationConfidence: 80,
    brand: "Apple",
    category: "Laptops",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
    bestPrice: 99900,
    originalPrice: 114900,
    rating: 4.9,
    reviews: 2310,
    recommendation: "BUY_NOW",
    predictionConfidence: 91,
    offers: [
      {
        source: "Amazon",
        price: 99900,
        originalPrice: 114900,
        rating: 4.9,
        reviews: 1400,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Flipkart",
        price: 101990,
        originalPrice: 114900,
        rating: 4.8,
        reviews: 700,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Croma",
        price: 104900,
        originalPrice: 114900,
        rating: 4.8,
        reviews: 210,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
    ],
    history: genHistory(108000, 0.06),
    prediction: genPrediction(99900, 0.03),
  },
  {
    id: "samsung-s24-ultra",
    title: "Samsung Galaxy S24 Ultra 512GB Titanium Black",
    brand: "Samsung",
    category: "Smartphones",
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80",
    bestPrice: 119999,
    originalPrice: 139999,
    rating: 4.6,
    reviews: 4120,
    recommendation: "BUY_NOW",
    predictionConfidence: 82,
    offers: [
      {
        source: "Amazon",
        price: 121999,
        originalPrice: 139999,
        rating: 4.6,
        reviews: 2400,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Flipkart",
        price: 119999,
        originalPrice: 139999,
        rating: 4.6,
        reviews: 1500,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Reliance",
        price: 124999,
        originalPrice: 139999,
        rating: 4.5,
        reviews: 220,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
    ],
    history: genHistory(132000, 0.07),
    prediction: genPrediction(119999, 0.02),
  },
  {
    id: "dyson-v15",
    title: "Dyson V15 Detect Absolute Cordless Vacuum",
    brand: "Dyson",
    category: "Home",
    image: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800&q=80",
    bestPrice: 64900,
    originalPrice: 74900,
    rating: 4.7,
    reviews: 1820,
    recommendation: "WAIT",
    predictionConfidence: 71,
    offers: [
      {
        source: "Amazon",
        price: 64900,
        originalPrice: 74900,
        rating: 4.7,
        reviews: 1200,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Croma",
        price: 67900,
        originalPrice: 74900,
        rating: 4.6,
        reviews: 410,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Reliance",
        price: 69900,
        originalPrice: 74900,
        rating: 4.5,
        reviews: 210,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
    ],
    history: genHistory(70000, 0.05),
    prediction: genPrediction(64900, -0.06),
  },
  {
    id: "nike-pegasus-40",
    title: "Nike Air Zoom Pegasus 40 Running Shoes",
    dealScore: 61.0,
    recommendationBadge: "Budget Pick",
    recommendationAction: "BUY_NOW",
    recommendationReason: "Price is at a 14-day absolute low.",
    recommendationConfidence: 95,
    brand: "Nike",
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    bestPrice: 8997,
    originalPrice: 11995,
    rating: 4.5,
    reviews: 942,
    recommendation: "BUY_NOW",
    predictionConfidence: 78,
    offers: [
      {
        source: "Myntra",
        price: 8997,
        originalPrice: 11995,
        rating: 4.5,
        reviews: 600,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Amazon",
        price: 9495,
        originalPrice: 11995,
        rating: 4.4,
        reviews: 280,
        shipping: "Free",
        inStock: true,
        link: "#",
      },
      {
        source: "Flipkart",
        price: 9999,
        originalPrice: 11995,
        rating: 4.3,
        reviews: 62,
        shipping: "₹40",
        inStock: true,
        link: "#",
      },
    ],
    history: genHistory(10500, 0.09),
    prediction: genPrediction(8997, 0.05),
  },
];

export const categories = ["All", "Smartphones", "Laptops", "Audio", "Home", "Fashion"];

export const trendingSearches = [
  "iPhone 15 Pro",
  "Sony WH-1000XM5",
  "MacBook Air M3",
  "Samsung S24 Ultra",
  "Nike Pegasus",
  "Dyson V15",
];

export const forumThreads = [
  {
    id: "1",
    title: "Is now a good time to buy the Sony XM5?",
    author: "audiophile_22",
    avatar: "AU",
    replies: 47,
    upvotes: 218,
    tag: "Audio",
    time: "2h ago",
    excerpt: "Saw the price drop to ₹24,990 on Amazon. ML model says BUY_NOW. Anyone tracking?",
  },
  {
    id: "2",
    title: "iPhone 15 Pro — wait for Apple India sale?",
    author: "techbuyer",
    avatar: "TB",
    replies: 132,
    upvotes: 540,
    tag: "Smartphones",
    time: "5h ago",
    excerpt:
      "Historically prices drop ~8% in late Feb. Curious what others are seeing in their alerts.",
  },
  {
    id: "3",
    title: "Best deal on MacBook Air M3 for students?",
    author: "ml_student",
    avatar: "MS",
    replies: 28,
    upvotes: 91,
    tag: "Laptops",
    time: "1d ago",
    excerpt: "Education store vs Amazon vs Croma — share your finds with screenshots.",
  },
];
