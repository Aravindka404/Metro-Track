import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StationProvider } from './context/useStationContext.jsx';
import { NetworkView } from './views/NetworkView.jsx';
import { FocusView } from './views/FocusView.jsx';

export default function App() {
  return (
    <StationProvider>
      <BrowserRouter>
        <main className="w-screen min-h-[100dvh] h-[100dvh] relative overflow-hidden bg-[#0B0F19]">
          <Routes>
            <Route path="/" element={<NetworkView />} />
            <Route path="/train/:id" element={<FocusView />} />
          </Routes>
        </main>
      </BrowserRouter>
    </StationProvider>
  );
}
