import React, { createContext, useContext, useState, useCallback } from 'react';

// Context
const ModalManagerContext = createContext();

// Custom hook
export const useModalManager = () => {
  const context = useContext(ModalManagerContext);
  if (!context) {
    throw new Error('useModalManager must be used within a ModalManager');
  }
  return context;
};

// Manager component
export const ModalManager = ({ children, ...modalProps }) => {
  const [activeModal, setActiveModal] = useState(null);
  const [modalPropsState, setModalPropsState] = useState({});

  // Actions
  const showModal = useCallback((modalType, props = {}) => {
    setActiveModal(modalType);
    setModalPropsState(prev => ({ ...prev, [modalType]: props }));
  }, []);

  const hideModal = useCallback((modalType = null) => {
    if (modalType === null || modalType === activeModal) {
      setActiveModal(null);
    }
  }, [activeModal]);

  const hideAllModals = useCallback(() => {
    setActiveModal(null);
    setModalPropsState({});
  }, []);

  const setModalProps = useCallback((modalType, props) => {
    setModalPropsState(prev => ({ ...prev, [modalType]: props }));
  }, []);

  // Context value
  const value = {
    // State
    activeModal,
    modals: {
      projects: activeModal === 'projects',
      git: activeModal === 'git',
      prompts: activeModal === 'prompts',
      enhancer: activeModal === 'enhancer',
    },
    
    // Actions
    showModal,
    hideModal,
    hideAllModals,
    
    // Props management
    modalProps: modalPropsState,
    setModalProps,
    
    // Pass through props from parent
    ...modalProps,
  };

  return (
    <ModalManagerContext.Provider value={value}>
      {children}
    </ModalManagerContext.Provider>
  );
};

export default ModalManager;
