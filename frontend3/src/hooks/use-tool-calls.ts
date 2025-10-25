import { useState, useRef } from 'react';

export function useToolCalls(messages: any[], setLeftSidebarOpen: (open: boolean) => void, agentStatus: any, compact: boolean) {
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [leftSidebarState, setLeftSidebarState] = useState<'closed' | 'open'>('closed');
  const userClosedPanelRef = useRef(false);

  const toggleSidePanel = () => {
    setSidePanelOpen(!sidePanelOpen);
  };

  const handleSidePanelNavigate = (direction: 'prev' | 'next') => {
    // Placeholder implementation
    console.log('Navigate', direction);
  };

  return {
    toolCalls,
    setToolCalls,
    sidePanelOpen,
    setSidePanelOpen,
    leftSidebarState,
    setLeftSidebarState,
    toggleSidePanel,
    handleSidePanelNavigate,
    userClosedPanelRef,
  };
}
