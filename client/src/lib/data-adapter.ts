export const adaptProduct = (backendProduct: any, mlPrediction: any = null) => {
  return {
    id: backendProduct.id || backendProduct._id || backendProduct.asin || Math.random().toString(),
    title: backendProduct.title,
    brand: backendProduct.brand || "Unknown",
    category: backendProduct.category || "General",
    bestPrice: backendProduct.price || backendProduct.lowestPrice || 0,
    originalPrice: backendProduct.originalPrice || backendProduct.highestPrice || backendProduct.price || backendProduct.lowestPrice || 0,
    discount:
      (backendProduct.originalPrice > backendProduct.price) || (backendProduct.highestPrice > backendProduct.lowestPrice)
        ? Math.round(
            (((backendProduct.originalPrice || backendProduct.highestPrice) - (backendProduct.price || backendProduct.lowestPrice)) /
              (backendProduct.originalPrice || backendProduct.highestPrice)) *
              100,
          )
        : backendProduct.discount || 0,
    rating:
      backendProduct.sources && backendProduct.sources.length > 0
        ? backendProduct.sources[0].rating || 4.5
        : 4.5,
    reviewCount:
      backendProduct.sources && backendProduct.sources.length > 0
        ? backendProduct.sources[0].reviewCount || 0
        : 0,
    reviews:
      backendProduct.sources && backendProduct.sources.length > 0
        ? backendProduct.sources[0].reviewCount || 0
        : 0,
    image: backendProduct.image || backendProduct.imageUrl || "https://placehold.co/400x400?text=No+Image",
    stores: (backendProduct.sources || []).map((source: any) => {
      const pStr = source.platform || source.name || source.source || "Unknown";
      return {
        name: pStr.charAt(0).toUpperCase() + pStr.slice(1),
        price: source.price,
        url: source.link,
        inStock: source.availability === "in_stock" || source.availability === "In Stock",
      };
    }),
    offers: (backendProduct.sources || []).map((source: any) => {
      const pStr = source.platform || source.name || source.source || "Unknown";
      return {
        source: pStr.charAt(0).toUpperCase() + pStr.slice(1),
        price: source.price,
        originalPrice: source.originalPrice || source.price,
        rating: source.rating || 4.5,
        reviews: source.reviewCount || 0,
        shipping: "Free Delivery",
        inStock: source.availability === "in_stock" || source.availability === "In Stock",
        link: source.link,
      };
    }),
    history: mlPrediction?.history || [
      { date: "2023-10", price: backendProduct.highestPrice || 0 },
      { date: "2023-11", price: backendProduct.averagePrice || 0 },
      { date: "2023-12", price: backendProduct.lowestPrice || 0 },
    ],
    prediction:
      mlPrediction?.prediction?.predicted_price
        ? [
            {
              date: `In ${mlPrediction.prediction.days_ahead || 14} days`,
              price: mlPrediction.prediction.predicted_price,
            },
          ]
        : Array.from({ length: 14 }).map((_, i) => ({
            date: `Future ${i + 1}`,
            price: backendProduct.lowestPrice || 0,
          })),
    recommendation: mlPrediction?.recommendation?.recommendation || "WAIT",
    recommendationReason: mlPrediction?.recommendation?.reason || "Model expects a price drop soon. Wait before buying.",
    predictionConfidence: mlPrediction?.recommendation?.confidence ? Math.round(mlPrediction.recommendation.confidence * 100) : 75,
    features: backendProduct.searchKeywords || [],
  };
};


