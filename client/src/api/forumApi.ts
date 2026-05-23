import { axiosPrivate as api } from './axios';

export interface User {
  _id: string;
  name: string;
  profilePic?: string;
  createdAt?: string;
}

export interface ProductSummary {
  _id: string;
  title: string;
  imageUrl?: string;
  lowestPrice?: number;
  category?: string;
}

export interface ForumPost {
  _id: string;
  title: string;
  body: string;
  tags: string[];
  userId: User;
  productId?: ProductSummary;
  commentCount: number;
  views: number;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
  isPinned: boolean;
  isLocked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  viewerVote?: 'up' | 'down' | null;
}

export interface ForumComment {
  _id: string;
  postId: string;
  userId: User;
  parentId: string | null;
  text: string;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  viewerVote?: 'up' | 'down' | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  total: number;
  page: number;
  pages: number;
  count: number;
  [key: string]: any;
}

export interface PostListResponse extends PaginatedResponse<ForumPost> {
  posts: ForumPost[];
}

export interface CommentListResponse extends PaginatedResponse<ForumComment> {
  comments: ForumComment[];
}

export const forumApi = {
  getPosts: async (params?: { page?: number; limit?: number; q?: string; tag?: string; sort?: string; productId?: string }) => {
    const { data } = await api.get<PostListResponse>('/forum', { params });
    return data;
  },

  getPost: async (id: string) => {
    const { data } = await api.get<{ success: boolean; post: ForumPost }>(`/forum/${id}`);
    return data.post;
  },

  createPost: async (payload: { title: string; body: string; tags?: string[]; productId?: string }) => {
    const { data } = await api.post<{ success: boolean; post: ForumPost }>('/forum', payload);
    return data.post;
  },

  updatePost: async (id: string, payload: { title?: string; body?: string; tags?: string[] }) => {
    const { data } = await api.patch<{ success: boolean; post: ForumPost }>(`/forum/${id}`, payload);
    return data.post;
  },

  deletePost: async (id: string) => {
    const { data } = await api.delete<{ success: boolean }>(`/forum/${id}`);
    return data;
  },

  votePost: async (id: string, vote: 'up' | 'down') => {
    const { data } = await api.post<{
      success: boolean;
      voted: boolean;
      voteType: 'up' | 'down' | null;
      upvoteCount: number;
      downvoteCount: number;
      score: number;
    }>(`/forum/${id}/vote`, { vote });
    return data;
  },

  getComments: async (postId: string, params?: { page?: number; limit?: number; parentId?: string | null }) => {
    const { data } = await api.get<CommentListResponse>(`/forum/${postId}/comments`, { params });
    return data;
  },

  addComment: async (postId: string, payload: { text: string; parentId?: string | null }) => {
    const { data } = await api.post<{ success: boolean; comment: ForumComment }>(`/forum/${postId}/comments`, payload);
    return data.comment;
  },

  editComment: async (postId: string, commentId: string, payload: { text: string }) => {
    const { data } = await api.patch<{ success: boolean; comment: ForumComment }>(`/forum/${postId}/comments/${commentId}`, payload);
    return data.comment;
  },

  deleteComment: async (postId: string, commentId: string) => {
    const { data } = await api.delete<{ success: boolean }>(`/forum/${postId}/comments/${commentId}`);
    return data;
  },

  voteComment: async (postId: string, commentId: string, vote: 'up' | 'down') => {
    const { data } = await api.post<{
      success: boolean;
      voted: boolean;
      voteType: 'up' | 'down' | null;
      upvoteCount: number;
      downvoteCount: number;
      score: number;
    }>(`/forum/${postId}/comments/${commentId}/vote`, { vote });
    return data;
  },
};
