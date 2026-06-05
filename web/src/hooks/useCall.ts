import { useEffect, useRef, useCallback } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores';
import {
  createCall,
  updateCallStatus,
  subscribeToIncomingCalls,
  subscribeToSignals,
  cleanupSignals,
  joinCallRoom,
} from '@/services/signaling';
import { isSupabaseMode } from '@/lib/supabase';
import { CallManager } from '@/services/callManager';
import type { CallSession, CallType } from '@/types';
import { notifyIncomingCall, notifyMissedCall } from '@/services/notifications';

function clearTimer(ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

export function useCall() {
  const callManagerRef = useRef<CallManager | null>(null);
  const signalUnsubRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedRef = useRef<string | null>(null);
  const initiatorReadyRef = useRef(false);
  const activeCallRef = useRef<CallSession | null>(null);

  const {
    activeCall,
    incomingCall,
    isMuted,
    isCameraOff,
    isScreenSharing,
    callDuration,
    setActiveCall,
    setIncomingCall,
    toggleMute,
    toggleCamera,
    setScreenSharing,
    setCallDuration,
    setLocalStream,
    setRemoteStream,
    reset,
  } = useCallStore();
  const { profile, partner } = useAuthStore();

  activeCallRef.current = activeCall;

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToIncomingCalls(profile.uid, (call) => {
      if (activeCallRef.current) {
        if (!call) setIncomingCall(null);
        return;
      }
      setIncomingCall(call);
      if (call && partner && call.id !== notifiedRef.current) {
        notifiedRef.current = call.id;
        notifyIncomingCall(partner.displayName, call.type);
      }
      if (!call) notifiedRef.current = null;
    });
    return unsub;
  }, [profile?.uid, partner?.displayName, setIncomingCall]);

  useEffect(() => {
    if (activeCall?.status === 'active') {
      timerRef.current = setInterval(() => {
        setCallDuration(
          Math.floor((Date.now() - (activeCall.startedAt ?? Date.now())) / 1000),
        );
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall?.status, activeCall?.startedAt, setCallDuration]);

  const markConnected = useCallback(
    async (call: CallSession) => {
      clearTimer(ringTimerRef);
      await updateCallStatus(call.id, 'active');
      setActiveCall({ ...call, status: 'active', startedAt: call.startedAt ?? Date.now() });
    },
    [setActiveCall],
  );

  const attachManagerEvents = useCallback(
    (manager: CallManager, call: CallSession) => {
      manager.onLocalStream = setLocalStream;
      manager.onRemoteStream = (stream) => {
        setRemoteStream(stream);
        clearTimer(ringTimerRef);
      };
      manager.onConnectionStateChange = async (state) => {
        if (state === 'connected') await markConnected(call);
      };
    },
    [setLocalStream, setRemoteStream, markConnected],
  );

  const wireLegacySignals = useCallback(
    (manager: CallManager, call: CallSession, isInitiator: boolean) => {
      signalUnsubRef.current?.();
      signalUnsubRef.current = subscribeToSignals(call.id, profile!.uid, (signal) => {
        manager.handleSignal(signal);
      });
      if (isInitiator) {
        manager.initialize(true).catch(console.error);
      }
    },
    [profile],
  );

  const startCall = useCallback(
    async (type: CallType) => {
      if (!profile || !partner || activeCall) return;
      initiatorReadyRef.current = false;

      try {
        const callId = await createCall(profile.uid, partner.uid, type);
        const call: CallSession = {
          id: callId,
          callerId: profile.uid,
          calleeId: partner.uid,
          type,
          status: 'ringing',
          startedAt: Date.now(),
        };
        setActiveCall(call);
        setIncomingCall(null);

        ringTimerRef.current = setTimeout(async () => {
          await updateCallStatus(callId, 'missed');
          callManagerRef.current?.endCall();
          callManagerRef.current = null;
          reset();
        }, 45000);

        const manager = new CallManager(callId, profile.uid, partner.uid, type === 'video');
        callManagerRef.current = manager;
        attachManagerEvents(manager, call);

        if (isSupabaseMode()) {
          await joinCallRoom(callId, profile.uid, {
            onSignal: (signal) => {
              manager.handleSignal(signal).catch(console.error);
            },
            onPeerReady: async () => {
              if (initiatorReadyRef.current) return;
              initiatorReadyRef.current = true;
              try {
                await manager.initialize(true);
              } catch (err) {
                console.error(err);
                await updateCallStatus(callId, 'ended');
                reset();
              }
            },
            onHangup: () => {
              clearTimer(ringTimerRef);
              callManagerRef.current?.endCall();
              callManagerRef.current = null;
              reset();
            },
          });
        } else {
          wireLegacySignals(manager, call, true);
        }
      } catch (err) {
        console.error('Failed to start call', err);
        reset();
      }
    },
    [profile, partner, activeCall, setActiveCall, setIncomingCall, reset, attachManagerEvents, wireLegacySignals],
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !profile) return;
    clearTimer(ringTimerRef);
    const call = { ...incomingCall, status: 'connecting' as const };
    setActiveCall(call);
    setIncomingCall(null);

    try {
      const manager = new CallManager(
        incomingCall.id,
        profile.uid,
        incomingCall.callerId,
        incomingCall.type === 'video',
      );
      callManagerRef.current = manager;
      attachManagerEvents(manager, call);

      if (isSupabaseMode()) {
        await joinCallRoom(incomingCall.id, profile.uid, {
          onSignal: (signal) => {
            manager.handleSignal(signal).catch(console.error);
          },
          onHangup: () => {
            clearTimer(ringTimerRef);
            callManagerRef.current?.endCall();
            callManagerRef.current = null;
            reset();
          },
        });
        // Set up WebRTC before telling caller to send the offer
        await manager.initialize(false);
        await updateCallStatus(incomingCall.id, 'connecting', profile.uid);
      } else {
        wireLegacySignals(manager, call, false);
        await manager.initialize(false);
      }
    } catch (err) {
      console.error(err);
      await updateCallStatus(incomingCall.id, 'declined');
      reset();
    }
  }, [incomingCall, profile, setActiveCall, setIncomingCall, reset, attachManagerEvents, wireLegacySignals]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    clearTimer(ringTimerRef);
    await updateCallStatus(incomingCall.id, 'declined');
    if (partner) notifyMissedCall(partner.displayName);
    setIncomingCall(null);
  }, [incomingCall, partner, setIncomingCall]);

  const endCall = useCallback(async () => {
    clearTimer(ringTimerRef);
    if (activeCall) {
      await updateCallStatus(activeCall.id, 'ended');
      await cleanupSignals(activeCall.id);
    }
    signalUnsubRef.current?.();
    signalUnsubRef.current = null;
    callManagerRef.current?.endCall();
    callManagerRef.current = null;
    initiatorReadyRef.current = false;
    reset();
  }, [activeCall, reset]);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    callManagerRef.current?.toggleMute(!isMuted);
  }, [isMuted, toggleMute]);

  const handleToggleCamera = useCallback(() => {
    toggleCamera();
    callManagerRef.current?.toggleCamera(!isCameraOff);
  }, [isCameraOff, toggleCamera]);

  const toggleScreenShare = useCallback(async () => {
    const manager = callManagerRef.current;
    if (!manager) return;
    if (isScreenSharing) {
      await manager.stopScreenShare();
      setScreenSharing(false);
    } else {
      await manager.startScreenShare();
      setScreenSharing(true);
    }
  }, [isScreenSharing, setScreenSharing]);

  return {
    activeCall,
    incomingCall,
    isMuted,
    isCameraOff,
    isScreenSharing,
    callDuration,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute: handleToggleMute,
    toggleCamera: handleToggleCamera,
    toggleScreenShare,
  };
}
