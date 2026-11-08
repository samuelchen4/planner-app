import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

import { typeScale } from '../tokens';

// tailwind-merge only knows Tailwind's own scales. Unknown `text-*` classes are taken for colours,
// so our type scale (`text-subhead`) would cancel a colour (`text-muted`) or vice versa, and
// `font-rounded` would cancel `font-semibold`. Teach it our names.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: Object.keys(typeScale) }],
      'font-family': [{ font: ['rounded'] }],
    },
  },
});

/** Merge class names, letting later Tailwind classes override earlier ones (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
