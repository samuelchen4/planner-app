import { createElement } from 'react';
import { Platform } from 'react-native';

import { dateKey } from '@/features/day-view/time';

export interface PickerProps {
  value: Date;
  onChange: (date: Date) => void;
}

// Fallbacks for non-iOS platforms (iOS uses SwiftUI pickers, pickers.ios.tsx). Only the web build
// (browser tests) needs them for now: plain HTML inputs. Android gets nothing until it's a target.

const pad = (n: number) => String(n).padStart(2, '0');

export function CalendarPicker({ value, onChange }: PickerProps) {
  if (Platform.OS !== 'web') return null;
  return createElement('input', {
    type: 'date',
    value: dateKey(value),
    'aria-label': 'Date',
    style: { fontSize: 17, padding: 8, alignSelf: 'center' },
    onChange: (e: { target: { value: string } }) => {
      const [y, m, d] = e.target.value.split('-').map(Number);
      if (y) onChange(new Date(y, m - 1, d, value.getHours(), value.getMinutes()));
    },
  });
}

export function TimeWheel({ value, onChange }: PickerProps) {
  if (Platform.OS !== 'web') return null;
  return createElement('input', {
    type: 'time',
    value: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
    style: { fontSize: 17, padding: 8, alignSelf: 'center' },
    'aria-label': 'Time',
    onChange: (e: { target: { value: string } }) => {
      const [h, m] = e.target.value.split(':').map(Number);
      if (Number.isFinite(h)) {
        const d = new Date(value);
        d.setHours(h, m, 0, 0);
        onChange(d);
      }
    },
  });
}
