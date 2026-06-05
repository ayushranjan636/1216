const CALLS_KEY = '1216_demo_calls';
const SIGNALS_KEY = '1216_demo_signals';
const MESSAGES_KEY = '1216_demo_messages';
const CHANNEL = '1216-demo-bridge';

type Listener = () => void;
const listeners = new Set<Listener>();

let channel: BroadcastChannel | null = null;

function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => listeners.forEach((fn) => fn());
  }
  return channel;
}

export function demoBridgeSubscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function demoBridgeNotify() {
  getChannel()?.postMessage({ t: Date.now() });
  listeners.forEach((fn) => fn());
}

export function demoBridgeRead<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

export function demoBridgeWrite<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
  demoBridgeNotify();
}

export { CALLS_KEY, SIGNALS_KEY, MESSAGES_KEY };
