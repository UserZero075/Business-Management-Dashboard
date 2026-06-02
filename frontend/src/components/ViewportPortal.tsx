import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ViewportPortalProps = {
  children: ReactNode;
};

export function ViewportPortal({ children }: ViewportPortalProps) {
  return createPortal(children, document.body);
}
