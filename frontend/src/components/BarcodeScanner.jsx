import { useEffect, useRef, useState } from 'react';
import './BarcodeScanner.css';

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

const CAMERA_MESSAGES = {
  denied: 'Camera access is blocked. Allow it in your browser settings, or type the number below.',
  unavailable: "Couldn't open the camera. Type the number printed under the barcode instead.",
};

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const doneRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [cameraError, setCameraError] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stream;
    let rafId;
    let zxControls;
    let cancelled = false;

    function finish(code) {
      if (doneRef.current || cancelled) return;
      doneRef.current = true;
      navigator.vibrate?.(60);
      onDetectedRef.current(code);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('unavailable');
        setTyping(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (e) {
        if (cancelled) return;
        setCameraError(e?.name === 'NotAllowedError' ? 'denied' : 'unavailable');
        setTyping(true);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      setTorchSupported(Boolean(track?.getCapabilities?.().torch));

      // Android Chrome has a fast built-in reader; iPhone Safari doesn't, so fall back to ZXing
      let native = null;
      if ('BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const formats = NATIVE_FORMATS.filter(f => supported.includes(f));
          if (formats.length) native = new window.BarcodeDetector({ formats });
        } catch {
          native = null;
        }
      }

      if (native) {
        const tick = async () => {
          if (cancelled || doneRef.current) return;
          try {
            const codes = await native.detect(video);
            if (codes.length) {
              finish(codes[0].rawValue);
              return;
            }
          } catch {
            // frame not ready yet
          }
          rafId = requestAnimationFrame(tick);
        };
        tick();
      } else {
        const { BrowserMultiFormatOneDReader } = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new BrowserMultiFormatOneDReader();
        zxControls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) finish(result.getText());
        });
        if (cancelled) zxControls.stop();
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      zxControls?.stop();
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  const typedDigits = typed.replace(/\D/g, '');
  const typedValid = typedDigits.length >= 8 && typedDigits.length <= 14;

  function submitTyped(e) {
    e.preventDefault();
    if (!typedValid || doneRef.current) return;
    doneRef.current = true;
    onDetectedRef.current(typedDigits);
  }

  return (
    <div className="bs-screen" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <video ref={videoRef} className="bs-video" playsInline muted aria-hidden="true" />

      <div className="bs-top">
        <button className="bs-round" onClick={onClose} aria-label="Close scanner">✕</button>
        <span className="bs-title">Scan barcode</span>
        {torchSupported ? (
          <button
            className={`bs-round${torchOn ? ' bs-round--on' : ''}`}
            onClick={toggleTorch}
            aria-label={torchOn ? 'Turn torch off' : 'Turn torch on'}
            aria-pressed={torchOn}
          >
            🔦
          </button>
        ) : <span className="bs-round bs-round--spacer" />}
      </div>

      {!cameraError && (
        <>
          <p className="bs-hint">Line up the barcode inside the frame</p>
          <div className="bs-finder" aria-hidden="true">
            <span className="bs-corner bs-c1" /><span className="bs-corner bs-c2" />
            <span className="bs-corner bs-c3" /><span className="bs-corner bs-c4" />
            <span className="bs-laser" />
          </div>
        </>
      )}

      <div className="bs-bottom">
        {typing ? (
          <form className="bs-type" onSubmit={submitTyped}>
            {cameraError && <p className="bs-error">{CAMERA_MESSAGES[cameraError]}</p>}
            <label htmlFor="barcode-typed">Barcode number</label>
            <div className="bs-type-row">
              <input
                id="barcode-typed"
                className="bs-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 0 62800 00001 1"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                autoFocus
              />
              <button type="submit" className="bs-go" disabled={!typedValid}>Look up</button>
            </div>
          </form>
        ) : (
          <>
            <button className="bs-type-link" onClick={() => setTyping(true)}>⌨ Type the number instead</button>
            <span className="bs-note">Reads automatically, no button to press</span>
          </>
        )}
      </div>
    </div>
  );
}
