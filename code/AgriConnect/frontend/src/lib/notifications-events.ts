type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyNotificationsUpdated(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function onNotificationsUpdated(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
