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
  try {
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
  } catch {
    /* iOS / restricted contexts */
  }
}

export function notifyIncomingCall(callerName: string, callType: CallType) {
  showNotification(
    `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
    `${callerName} is calling…`,
    { tag: 'incoming-call' },
  );
}

export function notifyNewMessage(senderName: string, preview: string) {
  showNotification(senderName, preview.slice(0, 120), { tag: 'new-message' });
}

export function notifyMissedCall(callerName: string) {
  showNotification('Missed Call', `You missed a call from ${callerName}`, { tag: 'missed-call' });
}

export function notifyCallDeclined(name: string) {
  showNotification('Call Declined', `${name} declined the call`, { tag: 'call-declined' });
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function canUseNotifications() {
  return 'Notification' in window && Notification.permission === 'granted';
}
