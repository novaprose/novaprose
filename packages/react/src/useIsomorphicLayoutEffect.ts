import { useEffect, useLayoutEffect } from 'react';

// На сервере useLayoutEffect выдаёт предупреждение — там он всё равно не нужен.
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
