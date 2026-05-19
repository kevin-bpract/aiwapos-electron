import { useState } from 'react';
import type { ProductItem } from '../main/api/products';

interface ModalStates {
  globalSettingsModal: boolean;
  alertModal: boolean;
}

export interface AlertContent {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onClose?: () => void;
}

export const useModals = () => {
  const [modals, setModals] = useState<ModalStates>({
    globalSettingsModal: false,
    alertModal: false,
  });

  const [alertContent, setAlertContent] = useState<AlertContent>({
    title: '',
    message: '',
    type: 'info',
  });

  const [selectedProductForInfo, setSelectedProductForInfo] =
    useState<ProductItem | null>(null);

  const openModal = (modalName: keyof ModalStates) => {
    setModals((prev) => ({ ...prev, [modalName]: true }));
  };

  const closeModal = (modalName: keyof ModalStates) => {
    setModals((prev) => ({ ...prev, [modalName]: false }));
  };

  const closeAllModals = () => {
    setModals({
      globalSettingsModal: false,
      alertModal: false,
    });
  };

  const showAlert = (options: {
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose?: () => void;
  }) => {
    setAlertContent({
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      onClose: options.onClose,
    });
    openModal('alertModal');
  };

  return {
    modals,
    openModal,
    closeModal,
    closeAllModals,
    selectedProductForInfo,
    setSelectedProductForInfo,
    alertContent,
    showAlert,
  };
};
