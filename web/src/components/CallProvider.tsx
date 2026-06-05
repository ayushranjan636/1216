import { useEffect, useRef } from 'react';
import { CallContextProvider, useCallContext } from '@/context/CallContext';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores';
import { formatCallDuration } from '@/utils/date';
import { requestNotificationPermission } from '@/services/notifications';
import {
  IconMic, IconMicOff, IconVideo, IconCameraOff, IconScreen, IconClose, IconCheck,
} from '@/components/Icons';

function CallOverlay() {
  const {
    activeCall,
    incomingCall,
    isMuted,
    isCameraOff,
    isScreenSharing,
    callDuration,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  } = useCallContext();
  const { localStream, remoteStream } = useCallStore();
  const { partner } = useAuthStore();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const isVideo = (activeCall ?? incomingCall)?.type === 'video';
  const showOverlay = activeCall || incomingCall;
  const isActive = activeCall?.status === 'active' || activeCall?.status === 'connecting';
  const isIncoming = incomingCall && !activeCall;

  if (!showOverlay) return null;

  return (
    <div className={`call-overlay ${isVideo && isActive ? 'call-overlay-video' : ''}`}>
      <audio ref={remoteAudioRef} autoPlay playsInline className="call-remote-audio" />
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
      <CallOverlay />
    </CallContextProvider>
  );
}
