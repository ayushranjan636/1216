import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { subscribeMessages } from '@/services/chat';
import { notifyNewMessage, requestNotificationPermission } from '@/services/notifications';

/** Notify partner messages when tab is hidden or user is on another page. */
export function useMessageNotifications() {
  const { profile, partner } = useAuthStore();
  const location = useLocation();
  const lastMessageIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    requestNotificationPermission();
  }, [profile?.uid]);

  useEffect(() => {
    if (!profile || !partner) return;

    const unsub = subscribeMessages((messages) => {
      const latest = messages[messages.length - 1];
      if (!latest) return;

      if (!initializedRef.current) {
        initializedRef.current = true;
        lastMessageIdRef.current = latest.id;
        return;
      }

      if (latest.id === lastMessageIdRef.current) return;
      lastMessageIdRef.current = latest.id;

      if (latest.senderId === profile.uid) return;

      const onChatPage = location.pathname === '/chat';
      const shouldNotify = document.hidden || !onChatPage;
      if (!shouldNotify) return;

      const preview =
        latest.text
        ?? (latest.type === 'image' ? 'Sent a photo' : latest.type === 'video' ? 'Sent a video' : 'New message');

      notifyNewMessage(partner.displayName, preview);
    });

    return unsub;
  }, [profile?.uid, partner?.displayName, location.pathname]);
}
