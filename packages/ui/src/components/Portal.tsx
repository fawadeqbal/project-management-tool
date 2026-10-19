import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  children: ReactNode;
  /** Defaults to `document.body`. */
  container?: Element | null;
}

/** Renders children into `document.body` (client only). */
export function Portal({ children, container }: PortalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, container ?? document.body);
}
