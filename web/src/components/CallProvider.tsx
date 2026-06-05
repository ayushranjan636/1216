import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CallContextProvider, useCallContext } from '@/context/CallContext';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores';
import { formatCallDuration } from '@/utils/date';
import { canScreenShare } from '@/utils/device';
import { requestNotificationPermission } from '@/services/notifications';
import {
  IconMic, IconMicOff, IconVideo, IconCameraOff, IconScreen, IconClose, IconCheck,
  IconPhone, IconMessage,
} from '@/components/Icons';
import type { CallSession } from '@/types';

function callStatusLabel(
  call: CallSession | null,
  incoming: boolean,
  partnerOnline: boolean,
  duration: number,
): string {
  if (!call) return '';
  if (incoming) return `Incoming ${call.type === 'video' ? 'video' : 'voice'} call…`;
  if (call.status === 'declined') return 'Call denied';
  if (call.status === 'missed') return 'No answer';
  if (call.status === 'ringing') return partnerOnline ? 'Ringing…' : 'Calling…';
  if (call.status === 'active') return formatCallDuration(duration);
  return 'Connecting…';
}

/** Keeps media streams alive while call is active (even when minimized). */
function CallMedia() {
  const { activeCall, localStream, remoteStream } = useCallStore();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  if (!activeCall) return null;

  return (
    <div className="call-media-root" aria-hidden>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {/* Hidden tracks keep streams alive when overlay is minimized */}
      {localStream && <video autoPlay playsInline muted className="call-media-hidden" ref={(el) => { if (el) el.srcObject = localStream; }} />}
      {remoteStream && <video autoPlay playsInline className="call-media-hidden" ref={(el) => { if (el) el.srcObject = remoteStream; }} />}
    </div>
  );
}

function CallMiniBar() {
  const { activeCall, callMinimized, callDuration, endCall, expandCall, isMuted, toggleMute } = useCallContext();
  const { partner } = useAuthStore();

  if (!activeCall || !callMinimized) return null;
  if (activeCall.status === 'declined' || activeCall.status === 'missed') return null;

  const isVideo = activeCall.type === 'video';
  const statusText = callStatusLabel(activeCall, false, partner?.isOnline ?? false, callDuration);

  return (
    <header className="call-mini-bar glass">
      <button type="button" className="call-mini-info" onClick={expandCall}>
        <span className="call-mini-type">{isVideo ? <IconVideo size={16} /> : <IconPhone size={16} />}</span>
        <span className="call-mini-name">{partner?.displayName ?? 'Partner'}</span>
        <span className="call-mini-timer">{statusText}</span>
      </button>
      <div className="call-mini-actions">
        <button type="button" className="call-mini-btn" onClick={toggleMute} aria-label="Mute">
          {isMuted ? <IconMicOff size={18} /> : <IconMic size={18} />}
        </button>
        <button type="button" className="call-mini-btn call-mini-hangup" onClick={endCall} aria-label="End call">
          <IconClose size={18} />
        </button>
      </div>
    </header>
  );
}

function CallFullOverlay() {
  const {
    activeCall,
    incomingCall,
    callMinimized,
    isMuted,
    isCameraOff,
    isScreenSharing,
    callDuration,
    acceptCall,
    declineCall,
    endCall,
    minimizeCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useCallContext();
  const { localStream, remoteStream } = useCallStore();
  const { partner } = useAuthStore();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const isVideo = (activeCall ?? incomingCall)?.type === 'video';
  const isIncoming = incomingCall && !activeCall;
  const showFull = isIncoming || (activeCall && !callMinimized);
  const isTerminal = activeCall?.status === 'declined' || activeCall?.status === 'missed';
  const isActive = activeCall?.status === 'active' || activeCall?.status === 'connecting';
  const showVideoStage = isVideo && !isIncoming && !isTerminal && (isActive || !!remoteStream);
  const screenShareOk = canScreenShare();

  const attachLocalVideo = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStream) {
      el.srcObject = localStream;
      el.play().catch(() => {});
    }
  }, [localStream]);

  const attachRemoteVideo = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteStream) {
      el.srcObject = remoteStream;
      el.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, showFull, showVideoStage]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, showFull, showVideoStage]);

  if (!showFull) return null;

  const statusText = callStatusLabel(
    activeCall ?? incomingCall ?? null,
    !!isIncoming,
    partner?.isOnline ?? false,
    callDuration,
  );

  const goToChat = () => {
    minimizeCall();
    navigate('/chat');
  };

  return (
    <div className={`call-overlay ${showVideoStage ? 'call-overlay-video' : ''}`}>
      {showVideoStage && (
        <div className="call-video-stage">
          <video ref={attachRemoteVideo} autoPlay playsInline className="call-remote-video" />
          <div className="call-local-pip">
            <video ref={attachLocalVideo} autoPlay playsInline muted className="call-local-video call-local-mirror" />
            {isScreenSharing && <span className="screen-badge">Sharing screen</span>}
          </div>
          <div className="call-video-top-bar">
            <span>{partner?.displayName}</span>
            <span className="call-timer">{statusText}</span>
          </div>
        </div>
      )}

      <div className={`call-content ${showVideoStage ? 'call-content-floating' : ''}`}>
        {!isIncoming && activeCall && !isTerminal && (
          <button type="button" className="call-back-chat" onClick={goToChat}>
            <IconMessage size={16} />
            Back to chat
          </button>
        )}

        {!showVideoStage && !isVideo && (
          <img src="/logo.png" alt="" className="call-avatar-pulse" />
        )}

        {!showVideoStage && (
          <>
            <h2>{partner?.displayName ?? 'Partner'}</h2>
            <p className={`call-status ${isTerminal ? 'call-status-end' : ''}`}>{statusText}</p>
          </>
        )}

        {!isTerminal && (
          <div className="call-controls">
            {isIncoming ? (
              <>
                <button className="call-btn decline" onClick={declineCall} aria-label="Decline"><IconClose size={22} /></button>
                <button className="call-btn accept" onClick={acceptCall} aria-label="Accept"><IconCheck size={22} /></button>
              </>
            ) : (
              <>
                <button className={`call-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} aria-label="Mute">
                  {isMuted ? <IconMicOff size={22} /> : <IconMic size={22} />}
                </button>
                {isVideo && (
                  <>
                    <button className={`call-btn ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera} aria-label="Camera">
                      {isCameraOff ? <IconCameraOff size={22} /> : <IconVideo size={22} />}
                    </button>
                    {screenShareOk && (
                      <button className={`call-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare} aria-label="Share screen">
                        <IconScreen size={22} />
                      </button>
                    )}
                  </>
                )}
                <button className="call-btn decline" onClick={endCall} aria-label="End call"><IconClose size={22} /></button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore();

  useEffect(() => {
    if (profile) requestNotificationPermission(true);
  }, [profile?.uid]);

  return (
    <CallContextProvider>
      {children}
      <CallMedia />
      <CallMiniBar />
      <CallFullOverlay />
    </CallContextProvider>
  );
}
