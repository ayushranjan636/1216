export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function canScreenShare() {
  return !isMobileDevice() && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}
