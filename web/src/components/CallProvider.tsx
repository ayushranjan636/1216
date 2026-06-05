import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CallContextProvider, useCallContext } from '@/context/CallContext';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores';
import { formatCallDuration } from '@/utils/date';
import { requestNotificationPermission } from '@/services/notifications';
import {
  IconMic, IconMicOff, IconVideo, IconCameraOff, IconScreen, IconClose, IconCheck,
  IconPhone, IconMessage,
} from '@/components/Icons';

/** Keeps media streams alive while call is active (even when minimized). */
function CallMedia() {
  const { activeCall } = useCallStore();
  const { localStream, remoteStream } = useCallStore();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  if (!activeCall) return null;

  return (
    <div className="call-media-root" aria-hidden>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <video ref={remoteVideoRef} autoPlay playsInline muted={false} />
      <video ref={localVideoRef} autoPlay playsInline muted />
    </div>
  );
}

function CallMiniBar() {
  const { activeCall, callMinimized, callDuration, endCall, expandCall, isMuted, toggleMute } = useCallContext();
  const { partner } = useAuthStore();

  if (!activeCall || !callMinimized) return null;

  const isVideo = activeCall.type === 'video';
  const statusText =
    activeCall.status === 'active'
      ? formatCallDuration(callDuration)
      : activeCall.status === 'ringing'
        ? 'Calling…'
        : 'Connecting…';

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

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, showFull]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, showFull]);

  if (!showFull) return null;

  const isActive = activeCall?.status === 'active' || activeCall?.status === 'connecting';

  const goToChat = () => {
    minimizeCall();
    navigate('/chat');
  };

  return (
    <div className={`call-overlay ${isVideo && isActive ? 'call-overlay-video' : ''}`}>
      {isVideo && isActive && (
        <div className="call-video-stage">
          <video ref={remoteVideoRef} autoPlay playsInline className="call-remote-video" />
          <div className="call-local-pip">
            <video ref={localVideoRef} autoPlay playsInline muted className="call-local-video" />
            {isScreenSharing && <span className="screen-badge">Sharing screen</span>}
          </div>
          <div className="call-video-top-bar">
            <span>{partner?.displayName}</span>
            <span className="call-timer">{formatCallDuration(callDuration)}</span>
          </div>
        </div>
      )}

      <div className={`call-content ${isVideo && isActive ? 'call-content-floating' : ''}`}>
        {!isIncoming && activeCall && (
          <button type="button" className="call-back-chat" onClick={goToChat}>
            <IconMessage size={16} />
            Back to chat
          </button>
        )}

        {(!isVideo || !isActive) && !isVideo && (
          <img src="/logo.png" alt="" className="call-avatar-pulse" />
        )}

        {(!isVideo || !isActive) && (
          <>
            <h2>{partner?.displayName ?? 'Partner'}</h2>
            <p className="call-status">
              {isIncoming
                ? `Incoming ${isVideo ? 'video' : 'voice'} call…`
                : activeCall?.status === 'ringing'
                  ? 'Calling…'
                  : activeCall?.status === 'active'
                    ? formatCallDuration(callDuration)
                    : 'Connecting…'}
            </p>
          </>
        )}

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
                  <button className={`call-btn ${isScreenSharing ? 'active' : ''}`} onClick={toggleScreenShare} aria-label="Share screen">
                    <IconScreen size={22} />
                  </button>
                </>
              )}
              <button className="call-btn decline" onClick={endCall} aria-label="End call"><IconClose size={22} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore();

  useEffect(() => {
    if (profile) requestNotificationPermission();
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
