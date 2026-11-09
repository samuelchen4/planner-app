/**
 * A new row id: a UUID (v4), made on the device so creating works offline; the server's uuid
 * column keeps it as is. (Math.random-based, fine for ids. Swap for expo-crypto's randomUUID with
 * the next native rebuild.)
 */
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
