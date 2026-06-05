import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconFlip, IconSend, IconSnap } from '@/components/Icons';

interface Props {
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export function SnapCamera({ onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const startCamera = useCallback(async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setError('');
    } catch {
      setError('Camera access denied');
    }
  }, [facing]);

  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [startCamera]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL('image/jpeg', 0.85));
  };

  const send = () => {
    if (preview) {
      onCapture(preview);
      onClose();
    }
  };

  const content = (
    <div className="snap-overlay" role="dialog" aria-label="Snap camera">
      <div className="snap-header">
        <button type="button" className="snap-icon-btn" onClick={onClose} aria-label="Close"><IconClose size={20} /></button>
        <span className="snap-title"><IconSnap size={16} /> Snap</span>
        <button type="button" className="snap-icon-btn" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label="Flip camera"><IconFlip size={20} /></button>
      </div>

      <div className="snap-stage">
        {error ? (
          <p className="snap-error">{error}</p>
        ) : preview ? (
          <img src={preview} alt="Preview" className="snap-preview" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="snap-video" />
        )}
      </div>

      <canvas ref={canvasRef} hidden />

      <div className="snap-controls">
        {preview ? (
          <>
            <button type="button" className="snap-secondary" onClick={() => setPreview(null)}>Retake</button>
            <button type="button" className="snap-send-btn" onClick={send}>
              <IconSend size={18} />
              Send Snap
            </button>
          </>
        ) : (
          <button type="button" className="snap-shutter" onClick={capture} aria-label="Capture photo">
            <span className="snap-shutter-ring" />
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
