import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/http';
import { toast } from '@/shared/toast/toast-store';

type Snapshot = [QueryKey, unknown][];

export interface OptimisticMutationConfig<TData, TVars> {
  /** Lets indicators find in-flight writes: useIsMutating({ mutationKey }). */
  mutationKey?: QueryKey;
  mutationFn: (vars: TVars) => Promise<TData>;
  /**
   * Query key prefixes this mutation touches. Every cached query under them is snapshotted
   * before `apply` and restored if the request fails, then invalidated when it settles.
   */
  affects: (vars: TVars) => QueryKey[];
  /** Write the expected result into the cache (the "optimistic" step). */
  apply?: (client: QueryClient, vars: TVars) => void;
  /** Reconcile the cache with the server's answer (optional; invalidation runs regardless). */
  onSuccess?: (data: TData, vars: TVars, client: QueryClient) => void;
  /** Toast copy on failure; defaults to the ApiError's human message. */
  errorMessage?: (error: ApiError, vars: TVars) => string;
  /** Skip invalidation on settle (e.g. high-frequency edits that reconcile via onSuccess). */
  invalidate?: boolean;
}

/**
 * Template method for every optimistic write (ADR 0004):
 *   1. cancel in-flight reads   2. snapshot   3. apply   4. request
 *   5a. success → reconcile      5b. failure → roll back + toast    6. invalidate
 * Subclasses vary only steps 3 and 5a (`apply`, `onSuccess`).
 */
export function useOptimisticMutation<TData, TVars>(config: OptimisticMutationConfig<TData, TVars>) {
  const client = useQueryClient();
  return useMutation<TData, ApiError, TVars, { snapshot: Snapshot }>({
    mutationKey: config.mutationKey,
    mutationFn: async (vars) => {
      try {
        return await config.mutationFn(vars);
      } catch (err) {
        throw ApiError.from(err);
      }
    },
    onMutate: async (vars) => {
      const prefixes = config.affects(vars);
      await Promise.all(prefixes.map((queryKey) => client.cancelQueries({ queryKey })));
      const snapshot: Snapshot = prefixes.flatMap((queryKey) => client.getQueriesData({ queryKey }));
      config.apply?.(client, vars);
      return { snapshot };
    },
    onError: (error, vars, context) => {
      context?.snapshot.forEach(([key, data]) => client.setQueryData(key, data));
      toast.error(config.errorMessage?.(error, vars) ?? error.message);
    },
    onSuccess: (data, vars) => config.onSuccess?.(data, vars, client),
    onSettled: (_data, _error, vars) => {
      if (config.invalidate === false) return;
      config.affects(vars).forEach((queryKey) => void client.invalidateQueries({ queryKey }));
    },
  });
}
