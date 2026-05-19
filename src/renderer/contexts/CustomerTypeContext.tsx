import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { POSSettings } from '../../types/posSettings';

interface CustomerTypeContextValue {
  customerType: string;
  setCustomerType: (type: string) => void;
  userPriceList: string;
  isTypeLocked: boolean;
}

const CustomerTypeContext = createContext<CustomerTypeContextValue | undefined>(undefined);

export const useCustomerType = () => {
  const context = useContext(CustomerTypeContext);
  if (!context) {
    throw new Error('useCustomerType must be used within CustomerTypeProvider');
  }
  return context;
};

interface CustomerTypeProviderProps {
  children: ReactNode;
}

export const CustomerTypeProvider: React.FC<CustomerTypeProviderProps> = ({ children }) => {
  const [customerType, setCustomerType] = useState<string>('B2C');
  const [userPriceList, setUserPriceList] = useState<string>('Standard Selling');
  const [isTypeLocked, setIsTypeLocked] = useState<boolean>(false);

  // Load POS settings to determine initial customer type and price list
  useEffect(() => {
    const loadPOSSettings = async () => {
      try {
        const settings: POSSettings | null = await window.posSettings.get();
        if (settings?.sales_person_details && settings.sales_person_details.length > 0) {
          const currentSalesPerson = settings.sales_person_details[0];
          
          if (currentSalesPerson.price_list) {
            setUserPriceList(currentSalesPerson.price_list);
            
            // Derive customer type from price_list
            const priceList = currentSalesPerson.price_list.toUpperCase();
            let derivedType: string | null = null;
            
            if (priceList.includes('B2C') || priceList.includes('RETAIL') || priceList.includes('STANDARD')) {
              derivedType = 'B2C';
            } else if (priceList.includes('B2B') || priceList.includes('WHOLESALE')) {
              derivedType = 'B2B';
            }
            
            if (derivedType) {
              setCustomerType(derivedType);
              setIsTypeLocked(true);
            }
          }
        }
      } catch (error) {
        console.error('Error loading POS settings for customer type:', error);
      }
    };
    
    loadPOSSettings();
  }, []);

  const value: CustomerTypeContextValue = {
    customerType,
    setCustomerType: (type: string) => {
      if (!isTypeLocked) {
        setCustomerType(type);
      }
    },
    userPriceList,
    isTypeLocked,
  };

  return (
    <CustomerTypeContext.Provider value={value}>
      {children}
    </CustomerTypeContext.Provider>
  );
};
