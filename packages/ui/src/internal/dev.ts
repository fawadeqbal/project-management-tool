import { useEffect } from 'react';

/** True in Vite dev/test builds. Outside Vite (`import.meta.env` missing) warnings are skipped. */
export function isDev(): boolean {
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } };
  return meta.env?.DEV === true;
}

export function devWarn(message: string): void {
  if (isDev()) console.warn(`[@hearth/ui] ${message}`);
}

/** Warns once per mount (and whenever `message` changes) while `condition` holds. */
export function useDevWarning(condition: boolean, message: string): void {
  useEffect(() => {
    if (condition) devWarn(message);
  }, [condition, message]);
}

interface AccessibleNameProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  title?: string;
}

export function hasAccessibleName(props: AccessibleNameProps): boolean {
  return Boolean(props['aria-label'] || props['aria-labelledby'] || props.title);
}
