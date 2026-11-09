import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { AnytimeRowBody } from './anytime-list';
import type { DragLayer } from './drag-layer';
import { BlockBody } from './timeline-block';

/** What the floating copy shows: a row (Anytime look) or a block (grid look). */
export interface GhostTask {
  title: string;
  done: boolean;
  isList: boolean;
  hasNotes: boolean;
  look: 'row' | 'block';
  width: number;
  height: number;
  /** For the block look's time label. */
  startMin: number;
  endMin: number;
}

/** The lifted task, following the finger. Rendered last so it floats over everything. */
export function DragGhost({ layer, task }: { layer: DragLayer; task: GhostTask | null }) {
  const style = useAnimatedStyle(() => ({
    opacity: layer.opacity.get(),
    transform: [{ translateX: layer.x.get() }, { translateY: layer.y.get() }, { scale: 1.03 }],
  }));
  if (!task) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ghost, { width: task.width, height: task.height }, style]}
    >
      {task.look === 'row' ? (
        <AnytimeRowBody
          title={task.title}
          done={task.done}
          isList={task.isList}
          hasNotes={task.hasNotes}
        />
      ) : (
        <BlockBody
          title={task.title}
          startMin={task.startMin}
          endMin={task.endMin}
          compact={task.height < 40}
          planner
          done={task.done}
          isList={task.isList}
          hasNotes={task.hasNotes}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
