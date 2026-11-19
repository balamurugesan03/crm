import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  organization: null,
  accessToken: null,
  status: 'loading', // 'loading' | 'authenticated' | 'unauthenticated'

  setSession: ({ user, organization, accessToken }) =>
    set({ user, organization, accessToken, status: 'authenticated' }),

  setAccessToken: (accessToken) => set({ accessToken }),

  clearSession: () => set({ user: null, organization: null, accessToken: null, status: 'unauthenticated' }),
}));
