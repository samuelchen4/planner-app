import { cn } from '@planner/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { describeRecurrence, presetRecurrence, type Recurrence } from '@planner/core';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';

import { ANYTIME_ROW_H } from '@/features/day-view/anytime-list';
import { Checkbox } from '@/features/day-view/checkbox';
import {
  dateKey,
  formatTime,
  MINUTES_PER_DAY,
  parseDateKey,
  toLocalIso,
} from '@/features/day-view/time';
import { haptics } from '@/lib/haptics';
import { HabitHistory } from '@/features/habits/habit-history';
import { HabitBadge, HabitLookPicker } from '@/features/habits/habit-look';
import { entryId, useDayEntries } from '@/db/entries';
import { MAX_PRIORITY, type Task } from '@/db/schema';
import { taskTable } from '@/db/tables';
import {
  clearTaskTime,
  cyclePriority,
  deleteIfUntitled,
  deleteTask,
  entriesOf,
  newEntry,
  priorityOf,
  saveEntries,
  setTaskDate,
  setTaskTime,
  taskDay,
  taskTimes,
  updateTask,
} from '@/db/tasks';
import { priorityMarks, textOn, usePriorityColor } from '@/lib/priority';
import { askScope } from '@/lib/ask-scope';
import { useColors, useThemeStyle } from '@/lib/theme';
import {
  clearAllDaysTime,
  deleteAllDays,
  deleteThisDay,
  makeRecurring,
  recurrenceOf,
  setAllDaysTime,
  setRecurrence,
  stopRecurring,
  updateAllDays,
} from '@/db/recurring';

import { DraftInput } from './draft-input';
import { dayLabel, FieldRow, Separator } from './fields';
import { EventDetails } from './event-details';
import { RepeatEditor } from './repeat-editor';
import { CalendarPicker, TimeWheel } from './pickers';

/**
 * The details of one planner item, in a native sheet over the current screen (see the root
 * layout). Every kind of item uses this one view. Edits apply instantly: there's no Save button
 * (text fields save when editing ends, and when the sheet closes).
 *
 * Header: the title (tap to edit) and the item's subtasks as quiet rows (a task
 * with subtasks is a list). Body: date and time (each opens a picker in a modal, so the page never
 * reflows) and notes. Google events show read-only.
 */
export function ItemDetailsScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const entries = useDayEntries();
  const entry = entries.find((e) => entryId(e) === id);

  return (
    <ScrollView
      className="bg-app flex-1"
      contentContainerClassName="gap-5 px-5 pb-16 pt-8"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {!entry ? (
        <Text className="font-rounded text-title2 text-muted font-bold">Not found</Text>
      ) : entry.kind === 'item' ? (
        <ItemDetails item={entry.item} isNew={isNew === '1'} />
      ) : (
        <EventDetails entry={entry} />
      )}
    </ScrollView>
  );
}

/** Local midnight + minutes, as a Date (what the time pickers take). */
function atMinutes(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

type Picker = 'date' | 'time' | 'repeat' | null;

const KIND_NAME: Record<Task['type'], string> = {
  task: 'Task',
  time_block: 'Block',
  list: 'List',
  habit: 'Habit',
};

function ItemDetails({ item, isNew }: { item: Task; isNew: boolean }) {
  const colors = useColors();
  const [picker, setPicker] = useState<Picker>(null);
  const [edge, setEdge] = useState<'start' | 'end'>('start');

  const isHabit = item.type === 'habit';
  const titleRef = useRef<TextInputInstance>(null);
  // A new item: put the cursor in the title once the sheet is up (autoFocus didn't always take
  // when the sheet opened again).
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => titleRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isNew]);
  const [editingLook, setEditingLook] = useState(false);
  const key = taskDay(item);
  const day = key ? parseDateKey(key) : null;
  const times = taskTimes(item);

  // Recurring: a day of a series. Title, notes and priority change every day; the time asks.
  const recurring = !!item.series_id;
  const recurrence = recurrenceOf(item);
  const canRepeat = (item.type === 'task' || item.type === 'time_block') && !item.list_id;
  const [timeScope, setTimeScope] = useState<'one' | 'all'>('one');
  const [repeatDraft, setRepeatDraft] = useState<Recurrence | null>(null);
  const edit = (patch: Partial<Task>) =>
    recurring ? updateAllDays(item, patch) : updateTask(item.id, patch);
  const applyTime = (start: number, end: number) =>
    timeScope === 'all' ? setAllDaysTime(item, start, end) : setTaskTime(item.id, start, end);

  const openRepeat = () => {
    const first = recurrence?.start ?? key ?? dateKey(new Date());
    setRepeatDraft(recurrence?.rule ?? presetRecurrence('daily', first));
    setPicker('repeat');
  };
  const closeRepeat = () => {
    if (repeatDraft) {
      if (recurring) setRecurrence(item, repeatDraft);
      else makeRecurring(item, repeatDraft);
    }
    setRepeatDraft(null);
    setPicker(null);
  };
  const confirmStopRepeating = () =>
    Alert.alert(
      'Stop repeating?',
      'This day stays; the other days are removed (checked-off ones stay).',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop Repeating', style: 'destructive', onPress: () => stopRecurring(item) },
      ],
    );

  const openDate = () => {
    // Turning the date on starts at today, like Reminders; the calendar then changes it.
    if (!day) setTaskDate(item.id, new Date());
    setPicker('date');
  };
  const openTime = async () => {
    // A recurring task's time: for this day or every day? Asked once, then the wheel applies it.
    const scope = recurring ? await askScope('Change the time for…') : 'one';
    if (!scope) return;
    setTimeScope(scope);
    if (!times) {
      // A first time: the next whole hour today, else 9 AM, for an hour.
      const now = new Date();
      const isToday = !day || dateKey(day) === dateKey(now);
      const start = isToday ? Math.min((now.getHours() + 1) * 60, 23 * 60) : 9 * 60;
      if (scope === 'all') setAllDaysTime(item, start, start + 60);
      else setTaskTime(item.id, start, start + 60);
    }
    setEdge('start');
    setPicker('time');
  };
  const clearTime = async () => {
    const scope = recurring ? await askScope('Make this repeating task all-day?') : 'one';
    if (scope === 'one') clearTaskTime(item.id);
    if (scope === 'all') clearAllDaysTime(item);
  };
  // Deleting closes the sheet first; the row goes once the sheet is gone (deleting it while the
  // sheet is still sliding away would flash "Not found").
  const deleteOnClose = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      deleteOnClose.current?.();
    },
    [item.id],
  );
  const closeThen = (remove: () => void) => {
    haptics.tick();
    deleteOnClose.current = remove;
    if (router.canGoBack()) router.back();
    else remove();
  };
  const confirmDelete = () => {
    if (recurring) {
      Alert.alert('Delete Repeating Task?', undefined, [
        {
          text: 'Delete This Day',
          style: 'destructive',
          onPress: () => closeThen(() => deleteThisDay(item.id)),
        },
        {
          text: 'Delete All Days',
          style: 'destructive',
          onPress: () => closeThen(() => deleteAllDays(item)),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const kind = KIND_NAME[item.type];
    const entryCount = entriesOf(taskTable.all(), item.id).length;
    const extra =
      item.type === 'habit'
        ? 'Its history will be deleted too.'
        : entryCount
          ? `Its ${entryCount} ${entryCount === 1 ? 'item' : 'items'} will be deleted too.`
          : undefined;
    Alert.alert(`Delete ${kind}?`, extra, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => closeThen(() => deleteTask(item.id)),
      },
    ]);
  };

  const onTime = (d: Date) => {
    if (!times) return;
    const min = d.getHours() * 60 + d.getMinutes();
    if (edge === 'start') {
      // Moving the start keeps the duration.
      applyTime(min, min + (times.end - times.start));
    } else applyTime(times.start, min);
  };

  return (
    <>
      {/* Header: title (habits: with their badge and an Edit button), then subtasks */}
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          {isHabit && <HabitBadge habit={item} />}
          <DraftInput
            value={item.title}
            onCommit={(title) => edit({ title })}
            // Made by the add button: type its name straight away (focused above); closing without
            // one discards it.
            ref={titleRef}
            onUnmount={isNew ? () => deleteIfUntitled(item.id) : undefined}
            // Naming a new item and hitting Done creates it: the sheet closes (the title is saved
            // as the field unmounts). With no name, it just dismisses the keyboard.
            onSubmitEditing={
              isNew
                ? (e) => {
                    if (e.nativeEvent.text.trim() && router.canGoBack()) router.back();
                  }
                : undefined
            }
            placeholder={
              item.type === 'habit' ? 'New habit' : item.type === 'list' ? 'New list' : 'New task'
            }
            placeholderTextColor={colors.subtle}
            multiline
            scrollEnabled={false}
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            className="font-rounded text-title2 text-ink flex-1 p-0 font-bold"
            accessibilityLabel="Title"
          />
          {!isHabit && <PriorityButton item={item} />}
        </View>
        {/* Recurring tasks don't have subtasks (yet). */}
        {!isHabit && !recurring && <Subtasks parent={item} />}
      </View>

      {/* Body: when (not for habits: they're every day, untimed), then notes */}
      {!isHabit && (
        <View className="bg-card rounded-card overflow-hidden">
          <FieldRow
            icon="calendar"
            label="Date"
            value={dayLabel(key)}
            active={picker === 'date'}
            onPress={openDate}
            // A repeating task's day always has a date (changing it moves just this day).
            onClear={day && !recurring ? () => setTaskDate(item.id, null) : undefined}
          />
          <Separator />
          <FieldRow
            icon="clock"
            label="Time"
            value={
              times
                ? `${formatTime(times.start)} – ${formatTime(times.end)}${times.end > MINUTES_PER_DAY ? ' (next day)' : ''}`
                : day
                  ? 'All day'
                  : 'None'
            }
            active={picker === 'time'}
            onPress={() => void openTime()}
            onClear={times ? () => void clearTime() : undefined}
          />
          {canRepeat && (
            <>
              <Separator />
              <FieldRow
                icon="repeat"
                label={recurring ? 'Repeats' : 'Make recurring'}
                value={recurrence ? describeRecurrence(recurrence.rule, recurrence.start) : ''}
                active={picker === 'repeat'}
                onPress={openRepeat}
                onClear={recurring ? confirmStopRepeating : undefined}
              />
            </>
          )}
        </View>
      )}

      {/* A habit's look (colour and icon) is set up separately from its content: Edit swaps the
          history for the picker. */}
      {isHabit && editingLook ? (
        <HabitLookPicker habit={item} onChange={(patch) => updateTask(item.id, patch)} />
      ) : isHabit ? (
        // Habits: a calendar of done days and a note per day (instead of one note for the habit).
        <HabitHistory habit={item} />
      ) : (
        <View className="bg-card rounded-card px-4 py-3">
          <DraftInput
            value={item.notes ?? ''}
            onCommit={(notes) => edit({ notes: notes || null })}
            placeholder="Notes"
            placeholderTextColor={colors.subtle}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            className="text-body text-ink p-0"
            style={{ minHeight: 120 }}
            accessibilityLabel="Notes"
          />
        </View>
      )}

      {isHabit && (
        // Quiet on purpose: the look is set up once, the history is what you come here for.
        <Pressable
          onPress={() => setEditingLook((v) => !v)}
          accessibilityRole="button"
          className="border-border rounded-card min-h-11 flex-row items-center justify-center gap-2 active:opacity-60"
          style={{ borderWidth: StyleSheet.hairlineWidth }}
        >
          <SymbolView
            name={editingLook ? 'checkmark' : 'paintpalette'}
            size={14}
            tintColor={colors.muted}
          />
          <Text className="text-subhead text-muted">
            {editingLook ? 'Done' : 'Edit icon & colour'}
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        className="bg-card rounded-card min-h-11 items-center justify-center py-3 active:opacity-60"
      >
        <Text className="text-body text-danger">Delete {KIND_NAME[item.type]}</Text>
      </Pressable>

      <PickerModal
        visible={picker === 'date' && day !== null}
        title="Date"
        onClose={() => setPicker(null)}
      >
        {day && <CalendarPicker value={day} onChange={(d) => setTaskDate(item.id, d)} />}
      </PickerModal>

      <PickerModal
        visible={picker === 'repeat' && repeatDraft !== null}
        title="Repeat"
        onClose={closeRepeat}
      >
        {repeatDraft && (
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingBottom: 4 }}>
            <RepeatEditor
              value={repeatDraft}
              start={recurrence?.start ?? key ?? dateKey(new Date())}
              onChange={setRepeatDraft}
            />
          </ScrollView>
        )}
      </PickerModal>

      <PickerModal
        visible={picker === 'time' && times !== null && day !== null}
        title="Time"
        onClose={() => setPicker(null)}
      >
        {times && day && (
          <>
            {/* Which end the wheel edits; the wheel below has a fixed size, so switching doesn't
                move anything. */}
            <View className="flex-row gap-2">
              {(['start', 'end'] as const).map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setEdge(e)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: edge === e }}
                  className={cn(
                    'flex-1 items-center gap-0.5 rounded-xl py-2',
                    edge === e ? 'bg-accent/15' : 'bg-app',
                  )}
                >
                  <Text className="text-footnote text-muted">
                    {e === 'start' ? 'Starts' : 'Ends'}
                  </Text>
                  <Text
                    className={cn(
                      'text-headline font-semibold',
                      edge === e ? 'text-accent' : 'text-ink',
                    )}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatTime(e === 'start' ? times.start : times.end)}
                    {e === 'end' && times.end > MINUTES_PER_DAY ? ' +1' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TimeWheel
              // A fresh wheel per end, so it starts on that end's time.
              key={edge}
              value={atMinutes(day, edge === 'start' ? times.start : times.end)}
              onChange={onTime}
            />
          </>
        )}
      </PickerModal>
    </>
  );
}

const PRIORITY_NAMES = ['No priority', 'Low priority', 'Medium priority', 'High priority'];

/**
 * The priority toggle by the title: each tap steps none → ! → !! → !!! → none. None is an outlined,
 * muted "!"; a level fills the button with the colour its border has on the day view.
 */
function PriorityButton({ item }: { item: Task }) {
  const colors = useColors();
  const level = priorityOf(item);
  const fill = usePriorityColor(level);
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        // A repeating task's priority is the same every day.
        if (item.series_id) updateAllDays(item, { priority: (level + 1) % (MAX_PRIORITY + 1) });
        else cyclePriority(item.id);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={PRIORITY_NAMES[level]}
      accessibilityHint="Changes the priority"
      className="h-8 min-w-8 items-center justify-center self-start rounded-full px-2.5 active:opacity-60"
      style={fill ? { backgroundColor: fill } : { borderWidth: 1.5, borderColor: colors.border }}
    >
      <Text
        className="text-subhead font-bold"
        style={{ color: fill ? textOn(fill) : colors.subtle, letterSpacing: -0.5 }}
      >
        {priorityMarks(level)}
      </Text>
    </Pressable>
  );
}

/**
 * A centred card over a dimmed backdrop, holding a picker. Tap Done or outside to close. The page
 * behind doesn't change size, unlike pickers that expand inline.
 */
function PickerModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // A Modal renders outside the root view, so it needs the theme's colour variables again.
  const themeStyle = useThemeStyle();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-center px-4" style={themeStyle}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          className="absolute inset-0 bg-black/50"
        />
        <View className="bg-card rounded-card gap-3 p-4 shadow-lg shadow-black/20">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-headline text-ink font-semibold">{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Text className="text-body text-accent font-semibold">Done</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/**
 * The item's subtasks as quiet rows (no fill, hairline dividers, muted text, check on the right),
 * each a plain text field. They're edited locally while the sheet is open (adding or typing doesn't
 * re-render the screens behind it) and saved when it closes; empty ones are
 * dropped then. Return adds the next one; tapping the check toggles it.
 */
function Subtasks({ parent }: { parent: Task }) {
  const colors = useColors();
  const [rows, setRows] = useState(() => entriesOf(taskTable.all(), parent.id));
  // A newly added row focuses itself when it mounts.
  const [newId, setNewId] = useState<string | null>(null);

  const latest = useRef(rows);
  useEffect(() => {
    latest.current = rows;
  });
  const parentId = parent.id;
  useEffect(() => () => saveEntries(parentId, latest.current), [parentId]);

  const add = (afterId: string | null) => {
    const sub = newEntry(parent);
    setRows((rs) => {
      const at = afterId ? rs.findIndex((r) => r.id === afterId) : -1;
      return at < 0 ? [...rs, sub] : [...rs.slice(0, at + 1), sub, ...rs.slice(at + 1)];
    });
    setNewId(sub.id);
  };
  const edit = (id: string, patch: Partial<Task>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggle = (sub: Task) => {
    haptics.check();
    const done = sub.status !== 'done';
    edit(sub.id, {
      status: done ? 'done' : 'open',
      completed_at: done ? toLocalIso(new Date()) : null,
    });
  };

  return (
    <View>
      {rows.map((sub) => {
        const done = sub.status === 'done';
        return (
          // No fill, just a hairline under each row and muted text: subtasks sit in the
          // background of the item.
          <View
            key={sub.id}
            className="flex-row items-center pl-1 pr-1.5"
            style={{
              height: ANYTIME_ROW_H,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}
          >
            <TextInput
              value={sub.title}
              autoFocus={sub.id === newId}
              onChangeText={(title) => edit(sub.id, { title })}
              onSubmitEditing={() => add(sub.id)}
              placeholder="Subtask"
              placeholderTextColor={colors.subtle}
              submitBehavior="submit"
              returnKeyType="next"
              className={cn(
                'text-footnote h-full flex-1 p-0',
                done ? 'text-subtle line-through' : 'text-muted',
              )}
              accessibilityLabel="Subtask"
            />
            <Pressable
              onPress={() => toggle(sub)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              className="h-full items-end justify-center pl-3"
            >
              <Checkbox done={done} size={14} />
            </Pressable>
          </View>
        );
      })}
      <Pressable
        onPress={() => add(null)}
        accessibilityRole="button"
        className="flex-row items-center gap-2 px-1 active:opacity-60"
        style={{ minHeight: ANYTIME_ROW_H }}
      >
        <SymbolView name="plus" size={14} weight="semibold" tintColor={colors.accent} />
        <Text className="text-subhead text-accent font-semibold">
          {rows.length === 0 ? 'Add subtasks' : 'Add subtask'}
        </Text>
      </Pressable>
    </View>
  );
}
