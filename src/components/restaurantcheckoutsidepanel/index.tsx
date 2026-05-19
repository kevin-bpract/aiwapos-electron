import React, { useState, useEffect } from 'react';
import Button from '../ui/buttom';
import InputField from '../ui/input';
import RestaurantChekoutCartItem from '../restaurantchekoutcartitem';
import type { SaleItem } from '../../types/saleItem';
import Portal from '../portal';
import OrderHistoryModal from '../modals/orderhistorymodal';
import { formatCurrency } from '../../utils/format';
import { createSalesOrder, convertSalesOrdersToInvoice } from '../../main/api/salesOrders';
import { getModeOfPayments } from '../../main/api/invoice';

interface Props {
  items: SaleItem[];
  charges: number;
  discount: number;
  total: number;
  onClear: () => void;
  onIncreaseQuantity: (id: string) => void;
  onDecreaseQuantity: (id: string) => void;
  onRemoveItem: (id: string) => void;
  backendUrl: string;
}

type OrderType = 'dining' | 'parcel' | 'delivery';

const RestuarantCheckoutSidepanel: React.FC<Props> = ({
  items,
  charges,
  discount,
  total,
  onClear,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onRemoveItem,
  backendUrl,
}) => {
  const [orderType, setOrderType] = useState<OrderType>('dining');
  const [productImages, setProductImages] = useState<Map<string, string>>(new Map());
  const [orderHistoryModalVisible, setOrderHistoryModalVisible] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const getFullImageUrl = (imagePath: string | null | undefined): string => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const baseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseUrl}${path}`;
  };

  // Fetch product images for cart items
  useEffect(() => {
    const fetchImages = async () => {
      const imageMap = new Map<string, string>();
      for (const item of items) {
        if (item.productCode && !imageMap.has(item.productCode)) {
          try {
            const product = await window.products.get(item.productCode);
            if (product?.image) {
              const fullUrl = getFullImageUrl(product.image);
              imageMap.set(item.productCode, fullUrl);
            }
          } catch (error) {
            console.error(`Failed to fetch product ${item.productCode}:`, error);
          }
        }
      }
      setProductImages(imageMap);
    };
    if (items.length > 0) {
      fetchImages();
    }
  }, [items, backendUrl]);

  const validItems = items.filter(item => item.productCode && item.productCode.trim() !== '');

  const handleCreateOrder = async () => {
    if (validItems.length === 0 || !customerName.trim()) {
      return;
    }

    setIsCreatingOrder(true);
    try {
      const orderItems = validItems.map((item) => ({
        item_code: item.productCode || item.barcode,
        qty: item.quantity,
        rate: item.inclusivePrice,
      }));

      const response = await createSalesOrder({
        customer: customerName.trim(),
        items: orderItems,
      });

      if (response?.message?.success_key === 1) {
        const salesOrderName = response.message.sales_order;
        alert(`Sales Order created successfully!\nOrder ID: ${salesOrderName}`);
        
        // Clear the form
        onClear();
        setCustomerName('');
        setRefNumber('');
        setContactNumber('');
        setTenderedAmount('');
      } else {
        alert('Failed to create order. Please try again.');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (validItems.length === 0 || !customerName.trim()) {
      alert('Please add items and enter customer name');
      return;
    }

    const paymentAmount = parseFloat(tenderedAmount) || total;
    if (paymentAmount <= 0) {
      alert('Please enter a valid tendered amount');
      return;
    }

    setIsCreatingInvoice(true);
    try {
      // Step 1: Create sales order
      const orderItems = validItems.map((item) => ({
        item_code: item.productCode || item.barcode,
        qty: item.quantity,
        rate: item.inclusivePrice,
      }));

      const orderResponse = await createSalesOrder({
        customer: customerName.trim(),
        items: orderItems,
      });

      if (orderResponse?.message?.success_key !== 1) {
        alert('Failed to create sales order. Please try again.');
        setIsCreatingInvoice(false);
        return;
      }

      const salesOrderName = orderResponse.message.sales_order;

      // Step 2: Convert sales order to invoice with payment
      const { defaultMode } = await getModeOfPayments();
      const modeOfPayment = defaultMode || 'Cash';
      const invoiceResponse = await convertSalesOrdersToInvoice({
        sales_orders: [salesOrderName],
        payments: [
          {
            mode_of_payment: modeOfPayment,
            amount: paymentAmount,
          },
        ],
      });

      if (invoiceResponse?.message?.success_key === 1) {
        const invoiceNames = invoiceResponse.message.invoices || [salesOrderName];
        alert(`Invoice created and submitted successfully!\nInvoice ID: ${invoiceNames[0] || salesOrderName}`);
        
        // Clear the form
        onClear();
        setCustomerName('');
        setRefNumber('');
        setContactNumber('');
        setTenderedAmount('');
      } else {
        alert('Failed to create invoice. Please try again.');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-lg">
      {/* Header with Clear Cart Button */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Current Order</h2>
        <button
          onClick={onClear}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
          title="Clear all items"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {validItems.length > 0 ? (
          validItems.map((item, index) => (
            <RestaurantChekoutCartItem
              key={item.id}
              serialNumber={index + 1}
              title={item.description || item.productCode}
              titleArabic={item.descriptionArabic}
              price={item.inclusivePrice}
              quantity={item.quantity}
              imageUrl={productImages.get(item.productCode) || ''}
              onIncrease={() => onIncreaseQuantity(item.id)}
              onDecrease={() => onDecreaseQuantity(item.id)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))
        ) : (
          <div className="text-center text-gray-400 py-8">
            <svg
              className="w-12 h-12 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-sm">No items in order</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4 space-y-3">
        {/* Order Type Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setOrderType('dining')}
            className={`flex-1 py-2.5 px-3 rounded-lg font-medium transition-all duration-200 ${
              orderType === 'dining'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center">
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs">Dining</span>
            </div>
          </button>
          <button
            onClick={() => setOrderType('parcel')}
            className={`flex-1 py-2.5 px-3 rounded-lg font-medium transition-all duration-200 ${
              orderType === 'parcel'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center">
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="text-xs">Parcel</span>
            </div>
          </button>
          <button
            onClick={() => setOrderType('delivery')}
            className={`flex-1 py-2.5 px-3 rounded-lg font-medium transition-all duration-200 ${
              orderType === 'delivery'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <div className="flex flex-col items-center">
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
              <span className="text-xs">Delivery</span>
            </div>
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
          <span className="font-semibold text-gray-700">Total Amount</span>
          <span className="text-xl font-bold text-blue-600">{formatCurrency(total)}</span>
        </div>

        <InputField 
          placeholder="Enter customer name" 
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <InputField 
          placeholder="Ref Number" 
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
        />
        <InputField 
          placeholder="Contact Number" 
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
        />
        <InputField 
          placeholder="Tendered Amount" 
          value={tenderedAmount}
          onChange={(e) => setTenderedAmount(e.target.value)}
        />

        <div className="flex gap-2">
          <Button 
            onClick={() => setOrderHistoryModalVisible(true)}
            className="flex-1 bg-gray-600 hover:bg-gray-700 hover:text-white text-white font-medium"
          >
            Order History
          </Button>
          <Button className="flex-1 bg-gray-600 hover:bg-gray-700 hover:text-white text-white font-medium">
            Invoice History
          </Button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={isCreatingOrder || validItems.length === 0 || !customerName.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 hover:text-white text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-all duration-200"
          >
            {isCreatingOrder ? 'Creating...' : 'Order'}
          </button>
          <button
            type="button"
            onClick={handleCreateInvoice}
            disabled={isCreatingInvoice || validItems.length === 0 || !customerName.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 hover:text-white text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-all duration-200"
          >
            {isCreatingInvoice ? 'Creating Invoice...' : 'Invoice'}
          </button>
        </div>
      </div>

      {orderHistoryModalVisible && (
        <Portal
          onClose={() => setOrderHistoryModalVisible(false)}
          modalTitle="Order History"
        >
          <OrderHistoryModal
            onClose={() => setOrderHistoryModalVisible(false)}
          />
        </Portal>
      )}
    </div>
  );
};

export default RestuarantCheckoutSidepanel;
