import type { PlannerItem } from '@planner/core';
import { cn } from '@planner/ui';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
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
  parseDateKey,
  relativeDayName,
  toLocalIso,
} from '@/features/day-view/time';
import { haptics } from '@/lib/haptics';
import { HabitHistory } from '@/features/habits/habit-history';
import { HabitBadge, HabitLookPicker } from '@/features/habits/habit-look';
import { usePlannerStore } from '@/lib/planner-store';
import { useColors, useThemeStyle } from '@/lib/theme';

import {
  clearItemTime,
  discardIfUntitled,
  itemDayKey,
  itemTimes,
  newSubtask,
  setItemDate,
  setItemTime,
  subtasksOf,
  syncSubtasks,
  updateItem,
} from './item-edits';
import { DraftInput } from './draft-input';
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
  const { entries } = usePlannerStore();
  const entry = entries.find((e) => (e.kind === 'item' ? e.item.id : e.event.id) === id);

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
        <EventDetails
          title={entry.event.title}
          dayKey={
            entry.event.startAt ? dateKey(new Date(entry.event.startAt)) : entry.event.allDayStart
          }
          time={
            entry.event.startAt && entry.event.endAt
              ? `${formatTime(minutesOfIso(entry.event.startAt))} – ${formatTime(minutesOfIso(entry.event.endAt))}`
              : 'All day'
          }
        />
      )}
    </ScrollView>
  );
}

const minutesOfIso = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/** 'Today, Nov 8' / 'Tue, Nov 10' / 'None'. */
function dayLabel(key: string | null | undefined): string {
  if (!key) return 'None';
  const day = parseDateKey(key);
  const name = relativeDayName(day);
  return name.includes(',')
    ? name
    : `${name}, ${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** Local midnight + minutes, as a Date (what the time pickers take). */
function atMinutes(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

type Picker = 'date' | 'time' | null;

function ItemDetails({ item, isNew }: { item: PlannerItem; isNew: boolean }) {
  const { setEntries } = usePlannerStore();
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
  const key = itemDayKey(item);
  const day = key ? parseDateKey(key) : null;
  const times = itemTimes(item);

  const openDate = () => {
    // Turning the date on starts at today, like Reminders; the calendar then changes it.
    if (!day) setEntries((prev) => setItemDate(prev, item.id, new Date()));
    setPicker('date');
  };
  const openTime = () => {
    if (!times) {
      // A first time: the next whole hour today, else 9 AM, for an hour.
      const now = new Date();
      const isToday = !day || dateKey(day) === dateKey(now);
      const start = isToday ? Math.min((now.getHours() + 1) * 60, 23 * 60) : 9 * 60;
      setEntries((prev) => setItemTime(prev, item.id, start, start + 60));
    }
    setEdge('start');
    setPicker('time');
  };
  const onTime = (d: Date) => {
    if (!times) return;
    const min = d.getHours() * 60 + d.getMinutes();
    setEntries((prev) =>
      edge === 'start'
        ? // Moving the start keeps the duration.
          setItemTime(prev, item.id, min, min + (times.end - times.start))
        : setItemTime(prev, item.id, times.start, min),
    );
  };

  return (
    <>
      {/* Header: title (habits: with their badge and an Edit button), then subtasks */}
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          {isHabit && <HabitBadge habit={item} />}
          <DraftInput
            value={item.title}
            onCommit={(title) => setEntries((prev) => updateItem(prev, item.id, { title }))}
            // Made by the add button: type its name straight away (focused above); closing without
            // one discards it.
            ref={titleRef}
            onUnmount={
              isNew ? () => setEntries((prev) => discardIfUntitled(prev, item.id)) : undefined
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
        </View>
        {!isHabit && <Subtasks parent={item} />}
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
            onClear={day ? () => setEntries((prev) => setItemDate(prev, item.id, null)) : undefined}
          />
          <Separator />
          <FieldRow
            icon="clock"
            label="Time"
            value={
              times
                ? `${formatTime(times.start)} – ${formatTime(times.end)}`
                : day
                  ? 'All day'
                  : 'None'
            }
            active={picker === 'time'}
            onPress={openTime}
            onClear={times ? () => setEntries((prev) => clearItemTime(prev, item.id)) : undefined}
          />
        </View>
      )}

      {/* A habit's look (colour and icon) is set up separately from its content: Edit swaps the
          history for the picker. */}
      {isHabit && editingLook ? (
        <HabitLookPicker
          habit={item}
          onChange={(patch) => setEntries((prev) => updateItem(prev, item.id, patch))}
        />
      ) : isHabit ? (
        // Habits: a calendar of done days and a note per day (instead of one note for the habit).
        <HabitHistory habit={item} />
      ) : (
        <View className="bg-card rounded-card px-4 py-3">
          <DraftInput
            value={item.notes ?? ''}
            onCommit={(notes) =>
              setEntries((prev) => updateItem(prev, item.id, { notes: notes || undefined }))
            }
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

      <PickerModal
        visible={picker === 'date' && day !== null}
        title="Date"
        onClose={() => setPicker(null)}
      >
        {day && (
          <CalendarPicker
            value={day}
            onChange={(d) => setEntries((prev) => setItemDate(prev, item.id, d))}
          />
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
 * re-render the screens behind it) and written to the store when it closes; empty ones are
 * dropped then. Return adds the next one; tapping the check toggles it.
 */
function Subtasks({ parent }: { parent: PlannerItem }) {
  const { entries, setEntries } = usePlannerStore();
  const colors = useColors();
  const [rows, setRows] = useState(() => subtasksOf(entries, parent.id));
  // A newly added row focuses itself when it mounts.
  const [newId, setNewId] = useState<string | null>(null);

  const latest = useRef(rows);
  useEffect(() => {
    latest.current = rows;
  });
  const parentId = parent.id;
  useEffect(
    () => () => setEntries((prev) => syncSubtasks(prev, parentId, latest.current)),
    [parentId, setEntries],
  );

  const add = (afterId: string | null) => {
    const sub = newSubtask(parent);
    setRows((rs) => {
      const at = afterId ? rs.findIndex((r) => r.id === afterId) : -1;
      return at < 0 ? [...rs, sub] : [...rs.slice(0, at + 1), sub, ...rs.slice(at + 1)];
    });
    setNewId(sub.id);
  };
  const edit = (id: string, patch: Partial<PlannerItem>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggle = (sub: PlannerItem) => {
    haptics.check();
    const done = sub.status !== 'done';
    edit(sub.id, {
      status: done ? 'done' : 'open',
      completedAt: done ? toLocalIso(new Date()) : undefined,
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

/** One row of the body card: icon, label, value; tap to open its picker, ⓧ to clear. */
function FieldRow({
  icon,
  label,
  value,
  active,
  onPress,
  onClear,
}: {
  icon: SFSymbol;
  label: string;
  value: string;
  active?: boolean;
  onPress?: () => void;
  onClear?: () => void;
}) {
  const colors = useColors();
  return (
    <View className="min-h-12 flex-row items-center pr-4">
      <Pressable
        onPress={() => {
          // The picker modal opens over the sheet; don't leave the keyboard covering it.
          Keyboard.dismiss();
          onPress?.();
        }}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        className="min-h-12 flex-1 flex-row items-center gap-3 pl-4 active:opacity-60"
      >
        <SymbolView name={icon} size={18} tintColor={colors.accent} />
        <Text className="text-body text-ink flex-1">{label}</Text>
        <Text
          className={cn('text-body', active ? 'text-accent' : 'text-muted')}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
      </Pressable>
      {onClear && (
        // A sibling, not inside the row's button (a nested button is invalid on web).
        <Pressable
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label.toLowerCase()}`}
          className="ml-2 active:opacity-60"
        >
          <SymbolView name="xmark.circle.fill" size={17} tintColor={colors.subtle} />
        </Pressable>
      )}
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: 46,
      }}
    />
  );
}

/** A Google Calendar event: read-only (it's edited in Google). */
function EventDetails({
  title,
  dayKey,
  time,
}: {
  title: string;
  dayKey: string | undefined;
  time: string;
}) {
  return (
    <>
      <Text className="font-rounded text-title2 text-ink font-bold">{title}</Text>
      <View className="bg-card rounded-card overflow-hidden">
        <FieldRow icon="calendar" label="Date" value={dayLabel(dayKey)} />
        <Separator />
        <FieldRow icon="clock" label="Time" value={time} />
      </View>
      <Text className="text-footnote text-subtle px-1">From Google Calendar · read-only</Text>
    </>
  );
}
