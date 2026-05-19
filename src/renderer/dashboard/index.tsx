import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import POSSidebar from '../../components/sidebar';

import { useModals } from '../../hooks/useModals';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcut';
import KeyboardConfig from '../../constants/kb_config';
import Portal from '../../components/portal';
import GlobalSettingsModal from '../../components/modals/globalsettings';
import ShiftManager from '../components/ShiftManager';
import ShiftHistoryModal from '../../components/modals/shifthistorymodal';
import SalesSummaryModal from '../../components/modals/salessummarymodal';
import { Toaster } from 'sonner';
import { ShiftSessionGateProvider } from '../contexts/ShiftSessionGateContext';

export default function Dashboard() {
  const modals = useModals();
  const [openSessionModal, setOpenSessionModal] = useState<(() => void) | null>(null);
  const [showShiftHistory, setShowShiftHistory] = useState(false);
  const [showSalesSummary, setShowSalesSummary] = useState(false);
  /** Block customer dropdown until shift check finishes and session modal is dismissed */
  const [shiftBlocksCustomerSelection, setShiftBlocksCustomerSelection] = useState(true);

  useKeyboardShortcuts({
    [KeyboardConfig.showGlobalSettingsModal]: () =>
      modals.openModal('globalSettingsModal'),
    [KeyboardConfig.showSalesSummary]: () => setShowSalesSummary(true),
  });

  // ShiftManager registers its openSessionModal callback here
  const handleSessionToggle = useCallback((fn: () => void) => {
    setOpenSessionModal(() => fn);
  }, []);

  // Allow child routes to open the session modal via custom event
  useEffect(() => {
    const onOpenSession = () => openSessionModal?.();
    window.addEventListener('pos-open-session-modal', onOpenSession);
    return () => window.removeEventListener('pos-open-session-modal', onOpenSession);
  }, [openSessionModal]);

  return (
    <div className="flex flex-row h-screen">
      <POSSidebar
        onSessionClick={() => openSessionModal?.()}
        onShiftHistoryClick={() => setShowShiftHistory(true)}
      />
      <main className="flex-1 overflow-hidden">
        <ShiftSessionGateProvider
          value={{ blockCustomerSelection: shiftBlocksCustomerSelection }}
        >
          <ShiftManager
            onSessionToggle={handleSessionToggle}
            onShiftGateChange={setShiftBlocksCustomerSelection}
          />
          <Outlet />
        </ShiftSessionGateProvider>
        {modals.modals.globalSettingsModal && (
          <Portal
            onClose={() => modals.closeModal('globalSettingsModal')}
            modalTitle="Global Settings"
          >
            <GlobalSettingsModal
              onClose={() => modals.closeModal('globalSettingsModal')}
            />
          </Portal>
        )}
        {showShiftHistory && (
          <ShiftHistoryModal onClose={() => setShowShiftHistory(false)} />
        )}
        {showSalesSummary && (
          <SalesSummaryModal onClose={() => setShowSalesSummary(false)} />
        )}
        <Toaster
          position="top-center"
          richColors
          closeButton
          theme="light"
          toastOptions={{
            style: { fontFamily: 'inherit' },
            classNames: {
              toast: 'ds-toast',
              title: 'ds-toast-title',
              description: 'ds-toast-desc',
            },
          }}
        />
      </main>
    </div>
  );
}
