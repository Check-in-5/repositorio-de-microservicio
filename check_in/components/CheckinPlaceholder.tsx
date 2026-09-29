'use client';
import { useState } from 'react';
import SelectionView from './SelectionView';
import ScannerView from './ScannerView';
import StatusScan from './StatusScan';

// Orquestador de vistas
export default function CheckinPlaceholder() {
  const [currentView, setCurrentView] = useState<string>('selection');
  const [scanResult, setScanResult] = useState<string | null>(null);

  const handleOpenScanner = () => setCurrentView('scanner');
  const handleBackToSelection = () => setCurrentView('selection');
  const handleScanSimulation = (status: string) => setScanResult(status);
  const handleCloseModal = () => setScanResult(null);

  const mainContainerStyle = {
    backgroundColor: '#F8F9FA', // Fondo principal interno[cite: 21]
    marginTop: '-1rem',     
    marginBottom: '-1rem',  
    marginLeft: '-2rem',     
    marginRight: '-2rem',   
    minHeight: 'calc(70vh + 2rem)', 
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    fontFamily: 'Inter, sans-serif' // Fuente secundaria general[cite: 21]
  };

  return (
    <div style={mainContainerStyle}>
      {currentView === 'selection' && (
        <SelectionView onSelectQR={handleOpenScanner} />
      )}
      
      {currentView === 'scanner' && (
        <ScannerView 
          onBack={handleBackToSelection} 
          onSimulateScan={handleScanSimulation} 
        />
      )}

      {scanResult && (
        <StatusScan status={scanResult} onClose={handleCloseModal} />
      )}
    </div>
  );
}