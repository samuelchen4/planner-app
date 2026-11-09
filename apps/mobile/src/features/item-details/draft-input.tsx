import { useEffect, useRef, useState, type Ref } from 'react';
import { TextInput, type TextInputInstance, type TextInputProps } from 'react-native';

export type DraftInputProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'onEndEditing'> & {
  ref?: Ref<TextInputInstance>;
  value: string;
  /** Saves the text: when editing ends, and when the sheet closes mid-edit. */
  onCommit: (text: string) => void;
  /** Runs when the field goes away (sheet closed), after any last save. */
  onUnmount?: () => void;
};

/**
 * A text field that edits a local draft and writes it to the store when editing ends (not on
 * every keystroke, which would re-render every screen behind the sheet).
 */
export function DraftInput({ value, onCommit, onUnmount, ...rest }: DraftInputProps) {
  const [text, setText] = useState(value);
  // Typed but not yet saved; null when the store already has it.
  const pending = useRef<string | null>(null);
  const commit = useRef(onCommit);
  const unmount = useRef(onUnmount);
  useEffect(() => {
    commit.current = onCommit;
    unmount.current = onUnmount;
  });
  const flush = () => {
    if (pending.current !== null && pending.current !== value) commit.current(pending.current);
    pending.current = null;
  };
  // The sheet can close while a field is still focused: save what was typed.
  useEffect(
    () => () => {
      if (pending.current !== null) commit.current(pending.current);
      unmount.current?.();
    },
    [],
  );

  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        pending.current = t;
      }}
      onEndEditing={flush}
      {...rest}
    />
  );
}
