import { useEffect, useRef, useState } from 'react';

// An image field: take a photo with the device camera, or upload a file.
// Photos are shrunk so a phone picture fits the server's size limit —
// 1.5 MB for application documents, smaller for school logos/stamps.

const MAX_DOC_BYTES = 1_500_000;

interface ImageLimits {
  maxSide: number;
  maxBytes: number;
  // Keep a transparent background (PNG) when it fits, e.g. for a logo.
  transparent: boolean;
}

const DOCUMENT_LIMITS: ImageLimits = { maxSide: 1600, maxBytes: MAX_DOC_BYTES, transparent: false };

const bytesOf = (uri: string) => (uri.length * 3) / 4;

function encode(canvas: HTMLCanvasElement, limits: ImageLimits): string {
  if (limits.transparent) {
    const png = canvas.toDataURL('image/png');
    if (bytesOf(png) <= limits.maxBytes) return png;
  }
  // JPEG has no transparency, so paint a white background behind the image.
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  // Step the quality down until it fits (almost always fits first time).
  for (const q of [0.85, 0.7, 0.55, 0.4]) {
    const uri = flat.toDataURL('image/jpeg', q);
    if (bytesOf(uri) <= limits.maxBytes) return uri;
  }
  return flat.toDataURL('image/jpeg', 0.3);
}

function drawScaled(source: CanvasImageSource, width: number, height: number, limits: ImageLimits): string {
  const scale = Math.min(1, limits.maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return encode(canvas, limits);
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function imageFileToDataUri(file: File, limits: ImageLimits): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read that image'));
      img.src = url;
    });
    return drawScaled(img, img.naturalWidth, img.naturalHeight, limits);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function CameraModal({
  limits,
  onCapture,
  onClose,
}: {
  limits: ImageLimits;
  onCapture: (dataUri: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser can’t open the camera here. Use "Upload file" instead — on a phone it also lets you take a photo.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError('Couldn’t open the camera. Allow camera access in your browser, or use "Upload file" instead.');
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setSnapshot(drawScaled(video, video.videoWidth, video.videoHeight, limits));
  }

  return (
    <div className="camera-backdrop" role="dialog" aria-label="Take a photo">
      <div className="camera-panel">
        {error ? (
          <p className="error">{error}</p>
        ) : snapshot ? (
          <img src={snapshot} alt="Captured" className="camera-view" />
        ) : (
          <video ref={videoRef} className="camera-view" playsInline muted />
        )}

        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {snapshot ? (
            <>
              <button type="button" onClick={() => onCapture(snapshot)}>
                Use this photo
              </button>
              <button type="button" className="btn-secondary" onClick={() => setSnapshot(null)}>
                Retake
              </button>
            </>
          ) : (
            !error && (
              <>
                <button type="button" onClick={capture}>
                  Capture
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
                >
                  Switch camera
                </button>
              </>
            )
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small images for the school profile: logo, signature, stamp. */
export const BRANDING_LIMITS: ImageLimits = { maxSide: 500, maxBytes: 350_000, transparent: true };

export default function PhotoField({
  label,
  value,
  onChange,
  onError,
  allowPdf = false,
  limits = DOCUMENT_LIMITS,
  onClear,
}: {
  label: string;
  value?: string;
  onChange: (dataUri: string) => void;
  onError: (message: string | null) => void;
  allowPdf?: boolean;
  limits?: ImageLimits;
  // Shows a Remove button when set.
  onClear?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    onError(null);
    try {
      if (file.type.startsWith('image/')) {
        onChange(await imageFileToDataUri(file, limits));
      } else if (allowPdf && file.type === 'application/pdf') {
        if (file.size > MAX_DOC_BYTES) {
          onError(`${label} PDF must be under 1.5 MB — or take a photo of it instead`);
          return;
        }
        onChange(await readAsDataUri(file));
      } else {
        onError(allowPdf ? `${label} must be a photo or a PDF` : `${label} must be a photo`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCameraOpen(true)}>
          📷 Take photo
        </button>
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Upload file
        </button>
        {value && onClear && (
          <button type="button" className="btn-danger-soft" onClick={onClear}>
            Remove
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={allowPdf ? 'image/*,application/pdf' : 'image/*'}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {value &&
        (value.startsWith('data:application/pdf') ? (
          <span className="text-xs text-brand-700">PDF attached ✓</span>
        ) : (
          <img
            src={value}
            alt={`${label} preview`}
            className={`h-28 w-28 rounded-xl2 border border-stone-200 ${limits.transparent ? 'object-contain bg-white' : 'object-cover'}`}
          />
        ))}
      {cameraOpen && (
        <CameraModal
          limits={limits}
          onClose={() => setCameraOpen(false)}
          onCapture={(uri) => {
            onError(null);
            onChange(uri);
            setCameraOpen(false);
          }}
        />
      )}
    </div>
  );
}
