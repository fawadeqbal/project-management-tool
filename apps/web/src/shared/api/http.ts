import { API_PREFIX, type ApiErrorBody } from '@hearth/contracts';
import { authSnapshot } from '@/shared/auth/auth-store';

export type ApiErrorKind = ApiErrorBody['error']['kind'] | 'network';

/**
 * Every failed request becomes an ApiError. `message` is already written for people (the API
 * owns the copy), so UI code can show it directly in a toast or next to a field.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly details: Record<string, unknown> | undefined;

  constructor(init: {
    status: number;
    kind: ApiErrorKind;
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    details?: Record<string, unknown>;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.kind = init.kind;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
    this.details = init.details;
  }

  /** First message for a field, for inline errors: `error.field('email')`. */
  field(name: string): string | undefined {
    return this.fieldErrors[name]?.[0];
  }

  static from(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    return new ApiError({
      status: 0,
      kind: 'network',
      code: 'network.unreachable',
      message: 'We couldn’t reach Hearth. Check your connection — we’ll keep your changes until it’s back.',
    });
  }
}

const isErrorBody = (v: unknown): v is ApiErrorBody =>
  typeof v === 'object' && v !== null && 'error' in v && typeof (v as { error: unknown }).error === 'object';

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];
export type QueryParams = Record<string, QueryValue>;

/**
 * Arrays become comma-separated values (the contracts parse `csv(...)`); empties are dropped.
 * `false` is dropped too: the contracts use `z.coerce.boolean()`, which reads "false" as true,
 * so an absent flag is the only way to say "no".
 */
export const toSearchParams = (query: QueryParams | undefined): string => {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {
  authSnapshot().signOut();
  if (!window.location.pathname.startsWith('/login')) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?next=${next}`);
  }
};
/** The app can swap the 401 behavior (e.g. use the router instead of a hard redirect). */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler) => {
  onUnauthorized = handler;
};

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const { token, workspaceId } = authSnapshot();
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}${toSearchParams(opts.query)}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw ApiError.from(err);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    if (isErrorBody(data)) {
      throw new ApiError({ status: res.status, ...data.error });
    }
    throw new ApiError({
      status: res.status,
      kind: res.status === 401 ? 'unauthorized' : res.status === 404 ? 'not_found' : 'internal',
      code: `http.${res.status}`,
      message: 'Something went wrong on our side. Try again in a moment.',
    });
  }
  return data as T;
}

/**
 * Low-level HTTP client. Features build their own `features/<f>/api.ts` on top of it:
 *
 *   export const projectsApi = {
 *     list: () => http.get<ProjectDto[]>('/projects'),
 *     create: (input: CreateProjectInput) => http.post<ProjectDto>('/projects', input),
 *   };
 */
export const http = {
  get: <T>(path: string, query?: QueryParams, opts?: Omit<RequestOptions, 'query' | 'body'>) =>
    request<T>('GET', path, { ...opts, query }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...opts, body: body ?? {} }),
  patch: <T>(path: string, body: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...opts, body }),
  put: <T>(path: string, body: unknown, opts?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...opts, body }),
  delete: <T = void>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
  request,
};
