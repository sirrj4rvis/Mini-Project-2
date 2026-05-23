import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

// Environment Variable Configuration
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Centralized Public Instance
export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000, // 60s timeout for heavy scraping tasks
});

// Centralized Private Instance (Requires Auth)
export const axiosPrivate = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 60000,
});

// Request Interceptor: Attach Access Token
axiosPrivate.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token && config.headers) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle Token Refresh & Global Error Logging
axiosPrivate.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const prevRequest = error?.config as any;

    // Auto-Refresh Token Logic
    if (error?.response?.status === 401 && !prevRequest?.sent) {
      prevRequest.sent = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const response = await axiosInstance.post("/auth/refresh", {
          refreshToken,
        });

        const newAccessToken = response.data.accessToken;
        const newRefreshToken = response.data.refreshToken;

        localStorage.setItem("accessToken", newAccessToken);
        localStorage.setItem("refreshToken", newRefreshToken);

        prevRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
        return axiosPrivate(prevRequest);
      } catch (err) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(err);
      }
    }

    // Global Error Formatting
    const errorMessage =
      (error.response?.data as any)?.message || error.message || "An unexpected error occurred.";
    console.error(`[API Error] ${error.config?.url}:`, errorMessage);

    return Promise.reject(new Error(errorMessage));
  },
);

// Global Error Handler for Public Instance
axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const errorMessage =
      (error.response?.data as any)?.message || error.message || "An unexpected error occurred.";
    console.error(`[API Error] ${error.config?.url}:`, errorMessage);
    return Promise.reject(new Error(errorMessage));
  },
);

// Reusable Generic Request Utilities
export const api = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.get(url, config);
    return response.data;
  },
  post: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.post(url, data, config);
    return response.data;
  },
  put: async <T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.put(url, data, config);
    return response.data;
  },
  delete: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response: AxiosResponse<T> = await axiosInstance.delete(url, config);
    return response.data;
  },
};
