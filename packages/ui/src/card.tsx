import { View, type ViewProps } from 'react-native';

import { cn } from './cn';

/** Raised white surface on the app background. */
export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn('rounded-card bg-card p-4 shadow-sm shadow-black/5', className)}
      {...props}
    />
  );
}
