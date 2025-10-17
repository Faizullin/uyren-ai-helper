'use client';

import { useState, useEffect } from 'react';

interface UseDashboardTourReturn {
  run: boolean;
  stepIndex: number;
  setStepIndex: (index: number) => void;
  stopTour: () => void;
  showWelcome: boolean;
  handleWelcomeAccept: () => void;
  handleWelcomeDecline: () => void;
}

export function useDashboardTour(): UseDashboardTourReturn {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if user has seen the tour before
    const hasSeenTour = localStorage.getItem('dashboard-tour-completed');
    const hasDeclinedTour = localStorage.getItem('dashboard-tour-declined');
    
    if (!hasSeenTour && !hasDeclinedTour) {
      setShowWelcome(true);
    }
  }, []);

  const stopTour = () => {
    setRun(false);
    setStepIndex(0);
    localStorage.setItem('dashboard-tour-completed', 'true');
  };

  const handleWelcomeAccept = () => {
    setShowWelcome(false);
    setRun(true);
  };

  const handleWelcomeDecline = () => {
    setShowWelcome(false);
    localStorage.setItem('dashboard-tour-declined', 'true');
  };

  return {
    run,
    stepIndex,
    setStepIndex,
    stopTour,
    showWelcome,
    handleWelcomeAccept,
    handleWelcomeDecline,
  };
}
