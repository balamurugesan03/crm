import { useQuery } from '@tanstack/react-query';
import { aiApi } from '../../api/aiApi.js';

export function useAiStatus() {
  const { data } = useQuery({ queryKey: ['ai-status'], queryFn: aiApi.status, staleTime: 5 * 60_000 });
  return { configured: Boolean(data?.configured), model: data?.model, loaded: Boolean(data) };
}

export function aiErrorMessage(err) {
  return err?.response?.data?.message || err?.message || 'AI request failed';
}
