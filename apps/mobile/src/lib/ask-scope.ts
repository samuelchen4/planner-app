import { Alert } from 'react-native';

/** Which days of a recurring task a change applies to; null = cancelled. */
export type RepeatScope = 'one' | 'all' | null;

/** Ask whether a change to a recurring task is for this day only or for all its days. */
export function askScope(title: string): Promise<RepeatScope> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      'This task repeats.',
      [
        { text: 'This Day Only', onPress: () => resolve('one') },
        { text: 'All Days', onPress: () => resolve('all') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}
