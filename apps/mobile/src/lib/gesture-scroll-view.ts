import { cssInterop } from 'nativewind';
import { ScrollView } from 'react-native-gesture-handler';

// Gesture Handler's ScrollView takes part in gesture arbitration, so a long-press drag inside it
// stops the scroll instead of fighting it. Register it with NativeWind so className works on it.
cssInterop(ScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export { ScrollView as GestureScrollView };
