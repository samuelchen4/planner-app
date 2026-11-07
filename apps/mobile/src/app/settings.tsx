import { Card } from '@planner/ui';
import { ScrollView, Text } from 'react-native';

export default function SettingsScreen() {
  return (
    <ScrollView
      className="bg-app flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pb-8 pt-4"
    >
      <Text className="font-rounded text-large-title text-ink font-bold">Settings</Text>
      <Card>
        <Text className="text-body text-muted">
          Connected calendars and account settings go here.
        </Text>
      </Card>
    </ScrollView>
  );
}
