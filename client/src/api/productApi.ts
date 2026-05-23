import { api } from "./axios";

export interface SearchParams {
  q: string;
  page?: number;
  category?: string;
  platform?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export const productApi = {
  search: (params: SearchParams) => {
    return api.get<any>("/products/search", { params });
  },

  getById: (id: string) => {
    return api.get<any>(`/products/${id}`);
  },

  getHistory: (id: string, days: number = 30) => {
    return api.get<any>(`/products/${id}/history`, { params: { days } });
  },

  getCompare: (id: string) => {
    return api.get<any>(`/products/${id}/compare`);
  },

  getPrediction: (id: string) => {
    return api.get<any>(`/products/${id}/predict`);
  },

  getTrending: (limit: number = 12) => {
    return api.get<any>("/products/trending", { params: { limit } });
  },

  getAutocomplete: (q: string) => {
    return api.get<any>("/products/autocomplete", { params: { q } });
  },

  toggleWatchlist: (id: string) => {
    return api.post<any>(`/products/${id}/watchlist`);
  },

  getAmazonReviews: (id: string) => {
    return api.get<any>(`/products/${id}/amazon-reviews`);
  },
};
