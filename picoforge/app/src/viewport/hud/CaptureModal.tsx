import { useState } from "react";
import "./CaptureModal.css";

interface Props {
  onClose: () => void;
  onCapture: (size: number, pt: boolean) => Promise<void>;
  isCapturing: boolean;
  progress: { spp: number; maxSpp: number } | null;
}

export function CaptureModal({ onClose, onCapture, isCapturing, progress }: Props) {
  const [size, setSize] = useState(1024);
  const [pt, setPt] = useState(true);

  return (
    <div className="capture-modal-overlay">
      <div className="capture-modal" role="dialog" aria-labelledby="capture-title">
        <h2 id="capture-title">Showcase Export</h2>
        
        <div className="capture-form">
          <label>
            <span>Resolution (Square)</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={isCapturing}>
              <option value={1024}>1024 x 1024</option>
              <option value={2048}>2048 x 2048</option>
              <option value={4096}>4096 x 4096</option>
            </select>
          </label>

          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={pt} 
              onChange={(e) => setPt(e.target.checked)} 
              disabled={isCapturing} 
            />
            <span>Studio Path Tracing (High Quality)</span>
          </label>
        </div>

        {isCapturing && progress && (
          <div className="capture-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(progress.spp / progress.maxSpp) * 100}%` }} 
              />
            </div>
            <span>{progress.spp} / {progress.maxSpp} samples</span>
          </div>
        )}

        <div className="capture-actions">
          <button onClick={onClose} disabled={isCapturing} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={() => onCapture(size, pt)} 
            disabled={isCapturing} 
            className="btn-primary"
          >
            {isCapturing ? "Capturing..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
