import { router } from 'expo-router';

/** Open an item's details sheet (`src/app/item/[id].tsx`). Callable from anywhere (JS thread). */
export function openItem(id: string) {
  router.push({ pathname: '/item/[id]', params: { id } });
}
