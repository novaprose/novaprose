import { useEffect, useLayoutEffect } from 'react';

// On the server useLayoutEffect prints a warning, and it isn't needed there anyway.
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
