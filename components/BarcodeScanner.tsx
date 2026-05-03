'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Barcode, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const startScanning = useCallback(async () => {
    if (!videoRef.current || !isOpen) return;

    try {
      setError(null);
      setIsScanning(true);

      const reader = new BrowserMultiFormatReader();

      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            onScan(result.getText());
            onClose();
          }
        }
      );
    } catch (e) {
      setError('Failed to access camera. Please ensure camera permissions are granted.');
      setIsScanning(false);
    }
  }, [onScan, onClose, isOpen]);

  useEffect(() => {
    if (isOpen) {
      startScanning();
    }
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, [isOpen, startScanning]);

  const handleClose = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-white">
          <Barcode className="w-6 h-6" />
          <span className="font-bold">Scan Barcode</span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-40 border-2 border-tactical-blue rounded-xl bg-transparent">
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-tactical-blue" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-tactical-blue" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-tactical-blue" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-tactical-blue" />
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-white/60 text-sm">
            {isScanning ? 'Position barcode within the frame' : 'Initializing camera...'}
          </p>
        </div>

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center p-6">
              <p className="text-tactical-red font-semibold mb-2">Camera Error</p>
              <p className="text-white/60 text-sm mb-4">{error}</p>
              <button onClick={startScanning} className="btn-tactical-secondary">
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry Option */}
      <div className="p-4 border-t border-white/10">
        <p className="text-center text-white/40 text-xs mb-2">
          Camera not available?
        </p>
        <button
          onClick={onClose}
          className="w-full btn-tactical-secondary"
        >
          Enter Barcode Manually
        </button>
      </div>
    </div>
  );
}