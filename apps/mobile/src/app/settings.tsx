import { Card } from '@planner/ui';
import { ScrollView, Text } from 'react-native';

export default function SettingsScreen() {
  return (
    <ScrollView
      className="flex-1 bg-app"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-4 px-4 pb-8 pt-4">
      <Text className="text-large-title font-bold text-ink">Settings</Text>
      <Card>
        <Text className="text-body text-muted">Connected calendars and account settings go here.</Text>
      </Card>
    </ScrollView>
  );
}
