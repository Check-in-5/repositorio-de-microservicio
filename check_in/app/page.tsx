'use client';
import { useState } from 'react';
import SelectionView from '../components/SelectionView';
import ScannerView from '../components/ScannerView';
import StatusScan from '../components/StatusScan';

// Punto de entrada aislado
export default function CheckinApp() {
  const [currentView, setCurrentView] = useState<string>('selection');
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Navegacion a camara
  const handleOpenScanner = () => {
    setCurrentView('scanner');
  };

  // Navegacion a ingreso manual
  const handleOpenCode = () => {
    setCurrentView('code');
  };

  // Retorno al inicio
  const handleBackToSelection = () => {
    setCurrentView('selection');
  };

  // Recepcion de validacion
  const handleScanSimulation = (status: string) => {
    setScanResult(status);
  };

  // Cierre de capa superior
  const handleCloseModal = () => {
    setScanResult(null);
  };

  const mainContainerStyle = {
    backgroundColor: '#E8DFD8',
    minHeight: '100vh', 
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const
  };

  return (
    <div style={mainContainerStyle}>
      {currentView === 'selection' && (
        <SelectionView 
          onSelectQR={handleOpenScanner} 
          onSelectCode={handleOpenCode} 
        />
      )}
      
      {currentView === 'scanner' && (
        <ScannerView 
          onBack={handleBackToSelection} 
          onSimulateScan={handleScanSimulation} 
        />
      )}

      {currentView === 'code' && (
        <CodeView 
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