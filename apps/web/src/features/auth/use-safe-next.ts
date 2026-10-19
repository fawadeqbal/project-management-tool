import { useSearchParams } from 'react-router-dom';

/** Where to go after signing in: `?next=` when it's a same-site path, otherwise My tasks. */
export function useSafeNext(): string {
  const [params] = useSearchParams();
  const next = params.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') && !next.startsWith('/register')) return next;
  return '/my-tasks';
}
