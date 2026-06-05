import { create } from 'zustand';
import type { CallSession } from '@/types';

interface CallState {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  callDuration: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  setActiveCall: (call: CallSession | null) => void;
  setIncomingCall: (call: CallSession | null) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  setScreenSharing: (v: boolean) => void;
  setCallDuration: (d: number) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  reset: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  incomingCall: null,
  isMuted: false,
  isCameraOff: false,
  isScreenSharing: false,
  callDuration: 0,
  localStream: null,
  remoteStream: null,
  setActiveCall: (activeCall) => set({ activeCall }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleCamera: () => set((s) => ({ isCameraOff: !s.isCameraOff })),
  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
  setCallDuration: (callDuration) => set({ callDuration }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  reset: () =>
    set({
      activeCall: null,
      incomingCall: null,
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
      callDuration: 0,
      localStream: null,
      remoteStream: null,
    }),
}));
