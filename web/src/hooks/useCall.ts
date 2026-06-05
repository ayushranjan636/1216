import { useEffect, useRef, useCallback } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores';
import {
  createCall,
  updateCallStatus,
  subscribeToIncomingCalls,
  subscribeToSignals,
  cleanupSignals,
} from '@/services/signaling';
import { CallManager } from '@/services/callManager';
import type { CallSession, CallType } from '@/types';
import { notifyIncomingCall, notifyMissedCall } from '@/services/notifications';

export function useCall() {
  const callManagerRef = useRef<CallManager | null>(null);
  const signalUnsubRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToIncomingCalls(profile.uid, (call) => {
      if (activeCall) {
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
  }, [profile?.uid, partner?.displayName, activeCall, setIncomingCall]);

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

  const wireManager = useCallback(
    (manager: CallManager, call: CallSession, isInitiator: boolean) => {
      manager.onLocalStream = setLocalStream;
      manager.onRemoteStream = setRemoteStream;
      manager.onConnectionStateChange = async (state) => {
        if (state === 'connected') {
          await updateCallStatus(call.id, 'active');
          setActiveCall({ ...call, status: 'active', startedAt: call.startedAt ?? Date.now() });
        }
      };

      signalUnsubRef.current?.();
      signalUnsubRef.current = subscribeToSignals(call.id, profile!.uid, (signal) => {
        manager.handleSignal(signal);
      });

      if (isInitiator) {
        manager.initialize(true).catch(console.error);
      }
    },
    [profile, setActiveCall, setLocalStream, setRemoteStream],
  );

  const startCall = useCallback(
    async (type: CallType) => {
      if (!profile || !partner || activeCall) return;
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
      wireManager(manager, call, true);
    },
    [profile, partner, activeCall, setActiveCall, setIncomingCall, reset, wireManager],
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !profile) return;
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    const call = { ...incomingCall, status: 'connecting' as const };
    setActiveCall(call);
    setIncomingCall(null);
    await updateCallStatus(incomingCall.id, 'connecting');

    try {
      const manager = new CallManager(
        incomingCall.id,
        profile.uid,
        incomingCall.callerId,
        incomingCall.type === 'video',
      );
      callManagerRef.current = manager;
      await manager.initialize(false);
      wireManager(manager, call, false);
    } catch (err) {
      console.error(err);
      await updateCallStatus(incomingCall.id, 'declined');
      reset();
    }
  }, [incomingCall, profile, setActiveCall, setIncomingCall, reset, wireManager]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) return;
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    await updateCallStatus(incomingCall.id, 'declined');
    if (partner) notifyMissedCall(partner.displayName);
    setIncomingCall(null);
  }, [incomingCall, partner, setIncomingCall]);

  const endCall = useCallback(async () => {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    if (activeCall) {
      await updateCallStatus(activeCall.id, 'ended');
      await cleanupSignals(activeCall.id);
    }
    signalUnsubRef.current?.();
    signalUnsubRef.current = null;
    callManagerRef.current?.endCall();
    callManagerRef.current = null;
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
