import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthResponseDto, LoginInput, RegisterInput } from '@hearth/contracts';
import { api } from '@/shared/api/client';
import { ApiError } from '@/shared/api/http';
import { useAuthStore } from '@/shared/auth/auth-store';

/** Login/register: on success store the token + profile and start with a clean cache. */
function useAuthMutation<TInput>(fn: (input: TInput) => Promise<AuthResponseDto>) {
  const signIn = useAuthStore((s) => s.signIn);
  const client = useQueryClient();
  return useMutation<AuthResponseDto, ApiError, TInput>({
    mutationFn: async (input) => {
      try {
        return await fn(input);
      } catch (err) {
        throw ApiError.from(err);
      }
    },
    onSuccess: (res) => {
      client.clear();
      signIn(res.accessToken, res.me);
    },
  });
}

export const useLogin = () => useAuthMutation<LoginInput>((input) => api.auth.login(input));
export const useRegister = () => useAuthMutation<RegisterInput>((input) => api.auth.register(input));
