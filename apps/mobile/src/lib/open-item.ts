import { router } from 'expo-router';

/**
 * Open an item's details sheet (`src/app/item/[id].tsx`). Callable from anywhere (JS thread).
 * `isNew`: just created by the add button; the sheet focuses the title, and closing it without a
 * title discards the item.
 */
export function openItem(id: string, { isNew = false }: { isNew?: boolean } = {}) {
  router.push({ pathname: '/item/[id]', params: isNew ? { id, new: '1' } : { id } });
}
