import { APP_CONFIG } from '@/config/app.config';
import type { CallSignal } from '@/types';
import { sendSignal } from './signaling';

export class CallManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string;
  private localUserId: string;
  private remoteUserId: string;
  private isVideo: boolean;
  private videoSender: RTCRtpSender | null = null;
  private pendingSignals: CallSignal[] = [];
  private remoteDescriptionSet = false;

  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: string) => void;

  constructor(callId: string, localUserId: string, remoteUserId: string, isVideo: boolean) {
    this.callId = callId;
    this.localUserId = localUserId;
    this.remoteUserId = remoteUserId;
    this.isVideo = isVideo;
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection({ iceServers: [...APP_CONFIG.stunServers] });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(
          this.callId,
          this.localUserId,
          this.remoteUserId,
          'ice-candidate',
          JSON.stringify(event.candidate),
        ).catch(console.error);
      }
    };

    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      this.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState ?? 'closed';
      if (state === 'connected') this.onConnectionStateChange?.('connected');
    };

    this.pc.oniceconnectionstatechange = () => {
      const ice = this.pc?.iceConnectionState;
      if (ice === 'connected' || ice === 'completed') {
        this.onConnectionStateChange?.('connected');
      }
    };
  }

  async initialize(isInitiator: boolean) {
    this.createPeerConnection();

    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: this.isVideo ? { facingMode: 'user' } : false,
    });
    this.localStream = this.cameraStream;
    this.onLocalStream?.(this.localStream);

    this.cameraStream.getTracks().forEach((track) => {
      const sender = this.pc!.addTrack(track, this.localStream!);
      if (track.kind === 'video') this.videoSender = sender;
    });

    await this.flushPendingSignals();

    if (isInitiator) {
      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);
      await sendSignal(
        this.callId,
        this.localUserId,
        this.remoteUserId,
        'offer',
        JSON.stringify(offer),
      );
    }
  }

  private async flushPendingSignals() {
    const queued = [...this.pendingSignals];
    this.pendingSignals = [];
    for (const signal of queued) {
      await this.handleSignal(signal);
    }
  }

  async handleSignal(signal: CallSignal) {
    if (!this.pc) {
      this.pendingSignals.push(signal);
      return;
    }

    const payload = JSON.parse(signal.payload);

    switch (signal.type) {
      case 'offer': {
        await this.pc.setRemoteDescription(payload);
        this.remoteDescriptionSet = true;
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await sendSignal(
          this.callId,
          this.localUserId,
          this.remoteUserId,
          'answer',
          JSON.stringify(answer),
        );
        await this.drainIceCandidates();
        break;
      }
      case 'answer': {
        await this.pc.setRemoteDescription(payload);
        this.remoteDescriptionSet = true;
        await this.drainIceCandidates();
        break;
      }
      case 'ice-candidate': {
        if (!this.remoteDescriptionSet) {
          this.pendingSignals.push(signal);
          return;
        }
        try {
          await this.pc.addIceCandidate(payload);
        } catch (err) {
          console.warn('ICE candidate error', err);
        }
        break;
      }
    }
  }

  private async drainIceCandidates() {
    const ice = this.pendingSignals.filter((s) => s.type === 'ice-candidate');
    this.pendingSignals = this.pendingSignals.filter((s) => s.type !== 'ice-candidate');
    for (const signal of ice) {
      try {
        await this.pc!.addIceCandidate(JSON.parse(signal.payload));
      } catch (err) {
        console.warn('ICE candidate error', err);
      }
    }
  }

  toggleMute(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  toggleCamera(off: boolean) {
    this.cameraStream?.getVideoTracks().forEach((track) => {
      track.enabled = !off;
    });
  }

  async startScreenShare() {
    if (!this.pc || !this.isVideo) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing not supported');
    }
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    const screenTrack = this.screenStream.getVideoTracks()[0];
    if (this.videoSender) {
      await this.videoSender.replaceTrack(screenTrack);
    }
    const audio = this.cameraStream?.getAudioTracks() ?? [];
    const combined = new MediaStream([...audio, screenTrack]);
    this.localStream = combined;
    this.onLocalStream?.(combined);
    screenTrack.onended = () => this.stopScreenShare();
  }

  async stopScreenShare() {
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    const camTrack = this.cameraStream?.getVideoTracks()[0];
    if (camTrack && this.videoSender) {
      await this.videoSender.replaceTrack(camTrack);
    }
    if (this.cameraStream) {
      this.localStream = this.cameraStream;
      this.onLocalStream?.(this.cameraStream);
    }
  }

  getIsScreenSharing() {
    return !!this.screenStream;
  }

  endCall() {
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.pc?.close();
    this.pc = null;
    this.localStream = null;
    this.cameraStream = null;
    this.screenStream = null;
    this.remoteStream = null;
    this.videoSender = null;
    this.pendingSignals = [];
    this.remoteDescriptionSet = false;
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }
}
