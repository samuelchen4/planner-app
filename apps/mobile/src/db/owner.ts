let owner = 'me';

export function setOwner(userId: string) {
  owner = userId;
}

export function ownerId(): string {
  return owner;
}
