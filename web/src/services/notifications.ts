import type { CallType } from '@/types';

let permissionAsked = false;

export async function requestNotificationPermission(force = false): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  if (permissionAsked && !force) return false;
  permissionAsked = true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showNotification(
  title: string,
  body: string,
  options?: { tag?: string; onClick?: () => void },
) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: '/logo.png',
    tag: options?.tag,
    requireInteraction: true,
  });
  if (options?.onClick) {
    n.onclick = () => {
      window.focus();
      options.onClick?.();
      n.close();
    };
  }
}

export function notifyIncomingCall(callerName: string, callType: CallType) {
  showNotification(
    `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
    `${callerName} is calling...`,
    { tag: 'incoming-call' },
  );
}

export function notifyNewMessage(senderName: string, preview: string) {
  showNotification(senderName, preview, { tag: 'new-message' });
}

export function notifyMissedCall(callerName: string) {
  showNotification('Missed Call', `You missed a call from ${callerName}`, { tag: 'missed-call' });
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
