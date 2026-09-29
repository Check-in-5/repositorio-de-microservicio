import { useEffect, useRef } from 'react';

interface ScannerProps {
  onBack: () => void;
  onSimulateScan: (status: string) => void;
}

export default function ScannerView({ onBack, onSimulateScan }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Permiso denegado");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    backgroundColor: '#333',
    position: 'relative' as const,
    fontFamily: 'Inter, sans-serif'
  };

  const videoStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const
  };

  const controlsStyle = {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    backgroundColor: 'rgba(248, 249, 250, 0.95)' // Basado en #F8F9FA[cite: 21]
  };

  const btnStyle = {
    backgroundColor: '#2F4374', //[cite: 21]
    color: '#FFFFFF',
    height: '40px', //[cite: 21]
    padding: '0 16px',
    borderRadius: '8px', //[cite: 21]
    border: 'none',
    fontWeight: 600, //[cite: 21]
    fontSize: '14px', //[cite: 21]
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    flex: 1
  };

  // Botones de simulación con colores de estado[cite: 21]
  const successBtnStyle = { ...btnStyle, backgroundColor: '#E2F4EA', color: '#1A6640' };
  const dangerBtnStyle = { ...btnStyle, backgroundColor: '#FDF0F2', color: '#B3261E' };

  return (
    <div style={containerStyle}>
      <video ref={videoRef} autoPlay playsInline style={videoStyle} />
      
      <div style={controlsStyle}>
        <button style={btnStyle} onClick={onBack}>Volver</button>
        <button style={successBtnStyle} onClick={() => onSimulateScan('accepted')}>Aprobar</button>
        <button style={dangerBtnStyle} onClick={() => onSimulateScan('rejected')}>Rechazar</button>
      </div>
    </div>
  );
}