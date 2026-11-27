export type ColorScheme = 'light' | 'dark';
export type ColorToken =
  | 'app'
  | 'card'
  | 'ink'
  | 'muted'
  | 'subtle'
  | 'border'
  | 'accent'
  | 'on-accent'
  | 'done'
  | 'success'
  | 'warning'
  | 'danger';

export declare const palette: Record<ColorScheme, Record<ColorToken, string>>;
export type NoteColor = 'yellow' | 'pink' | 'blue' | 'orange' | 'lavender';
export declare const noteColors: Record<
  ColorScheme,
  Record<NoteColor, { paper: string; edge: string }>
>;
/** 1 = !, 2 = !!, 3 = !!! (0 = none has no colour). */
export type PriorityLevel = 1 | 2 | 3;
export declare const priorityColors: Record<ColorScheme, Record<PriorityLevel, string>>;
export declare const typeScale: Record<string, [fontSize: string, lineHeight: string]>;
export declare function themeVariables(
  scheme: ColorScheme,
): Record<`--color-${ColorToken}`, string>;
