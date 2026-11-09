import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';

import { useColors, useScheme } from '@/lib/theme';

import type { PickerProps } from './pickers';

/** The native iOS month calendar (SwiftUI's graphical DatePicker), as in Calendar and Reminders. */
export function CalendarPicker({ value, onChange }: PickerProps) {
  const colors = useColors();
  return (
    <Host matchContents colorScheme={useScheme()} style={{ alignSelf: 'center' }}>
      <DatePicker
        selection={value}
        displayedComponents={['date']}
        onDateChange={onChange}
        modifiers={[datePickerStyle('graphical'), labelsHidden(), tint(colors.accent)]}
      />
    </Host>
  );
}

/** The iOS time wheel (hour, minute, AM/PM). */
export function TimeWheel({ value, onChange }: PickerProps) {
  const colors = useColors();
  return (
    <Host matchContents colorScheme={useScheme()} style={{ alignSelf: 'center' }}>
      <DatePicker
        selection={value}
        displayedComponents={['hourAndMinute']}
        onDateChange={onChange}
        modifiers={[datePickerStyle('wheel'), labelsHidden(), tint(colors.accent)]}
      />
    </Host>
  );
}
