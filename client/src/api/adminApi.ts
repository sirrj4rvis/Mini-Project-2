import { axiosPrivate as api } from './axios';

export interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  activeAlerts: number;
  totalForumPosts: number;
}

export interface DashboardData {
  success: boolean;
  stats: AdminStats;
  recentUsers: any[];
  topProducts: any[];
}

export interface UserManagement {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface UsersResponse {
  success: boolean;
  users: UserManagement[];
  total: number;
  page: number;
  pages: number;
}

export const adminApi = {
  getDashboardStats: async () => {
    const { data } = await api.get<DashboardData>('/admin/stats');
    return data;
  },

  getAllUsers: async (params?: { page?: number; limit?: number; search?: string }) => {
    const { data } = await api.get<UsersResponse>('/admin/users', { params });
    return data;
  },

  toggleUserStatus: async (id: string) => {
    const { data } = await api.patch<{ success: boolean; message: string; user: UserManagement }>(`/admin/users/${id}/toggle`);
    return data;
  },

  deleteProduct: async (id: string) => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/admin/products/${id}`);
    return data;
  },
};
