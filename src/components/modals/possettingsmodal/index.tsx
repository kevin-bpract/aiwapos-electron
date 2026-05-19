import React, { useState, useEffect } from 'react';
import Portal from '../../portal';
import { POSSettings } from '../../../types/posSettings';
import { useAuth } from '../../../renderer/contexts/AuthContext';

interface Props {
  onClose: () => void;
}

const POSSettingsModal: React.FC<Props> = ({ onClose }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<POSSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartBehavior, setCartBehavior] = useState<'increment' | 'new_line'>('increment');

  useEffect(() => {
    fetchSettings();
    loadCartBehavior();
  }, []);

  const loadCartBehavior = async () => {
    try {
      const behavior = await window.app_config.get('cart_item_behavior');
      if (behavior) {
        setCartBehavior(behavior as 'increment' | 'new_line');
      }
    } catch (err) {
      console.error('Error loading cart behavior:', err);
    }
  };

  const handleCartBehaviorChange = async (behavior: 'increment' | 'new_line') => {
    setCartBehavior(behavior);
    try {
      await window.app_config.save('cart_item_behavior', behavior);
      // Notify all hooks listening for this setting change
      window.dispatchEvent(new CustomEvent('cart_behavior_changed', { detail: { behavior } }));
    } catch (err) {
      console.error('Error saving cart behavior:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.posSettings.get();
      if (data) {
        setSettings(data);
      } else {
        setError('No settings found. Please sync data.');
      }
    } catch (err: any) {
      console.error('Error fetching POS settings:', err);
      setError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const salesPerson = settings?.sales_person_details?.find(
    (p) => p.user === user,
  ) || settings?.sales_person_details?.[0];

  const isTaxIncluded =
    (salesPerson?.is_this_tax_included_in_basic_rate ??
      parseInt(settings?.is_this_tax_included_in_basic_rate || '0')) ===
    1;

  const isEditItemRateAllowed = salesPerson?.edit_item_rate === 1;

  const userDefaultPaymentMode = salesPerson?.mode_of_payment || null;

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <Portal onClose={handleClose} modalTitle="POS Settings">
      <div className="w-[800px] max-w-full max-h-[70vh] overflow-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">Loading settings...</div>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && settings && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                General Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Company</label>
                  <p className="mt-1 text-sm text-gray-900">{settings.company}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Default Warehouse</label>
                  <p className="mt-1 text-sm text-gray-900">{settings.default_target_warehouse}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Cost Center</label>
                  <p className="mt-1 text-sm text-gray-900">{settings.cost_center}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Deduction Account</label>
                  <p className="mt-1 text-sm text-gray-900">{settings.deduction_account}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">View All Transaction Role</label>
                  <p className="mt-1 text-sm text-gray-900">{settings.view_all_transaction_role}</p>
                </div>
                {salesPerson?.enable_branch === 1 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Active Branch</label>
                    <p className="mt-1 text-sm font-bold text-blue-700">{salesPerson?.branch || 'Not Assigned'}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${isTaxIncluded ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {isTaxIncluded ? 'Tax Inclusive' : 'Tax Exclusive'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isTaxIncluded} readOnly className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label className="text-sm text-gray-700">Tax Included in Basic Rate</label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={settings.enable_customer_based_price_list === 1} readOnly className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label className="text-sm text-gray-700">Customer Based Price List</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={settings.override_sales_team_in_customer === 1} readOnly className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label className="text-sm text-gray-700">Override Sales Team in Customer</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={settings.payment_entry_based_on_sales_person === 1} readOnly className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label className="text-sm text-gray-700">Payment Entry Based on Sales Person</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isEditItemRateAllowed} readOnly className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                    <label className="text-sm text-gray-700">Edit Item Rate Allowed</label>
                  </div>

                  <div className="pt-2 border-t border-gray-200 mt-2">
                    <label className="text-sm font-medium text-gray-700 block mb-2">Cart Item Behavior</label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cartBehavior"
                          value="increment"
                          checked={cartBehavior === 'increment'}
                          onChange={() => handleCartBehaviorChange('increment')}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Increment Quantity (Default)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="cartBehavior"
                          value="new_line"
                          checked={cartBehavior === 'new_line'}
                          onChange={() => handleCartBehaviorChange('new_line')}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Add as New Line</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {settings.mode_of_payment_details && settings.mode_of_payment_details.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Mode of Payment</h3>

                {userDefaultPaymentMode && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Your Default Payment Mode</h4>
                    <p className="text-lg font-bold text-blue-700">{userDefaultPaymentMode}</p>
                    <p className="text-xs text-blue-600 mt-1">This mode will be pre-selected in checkout</p>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Payment Mode</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {settings.mode_of_payment_details.map((mode, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{mode.mode_of_payment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {settings.sales_person_details && settings.sales_person_details.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Person Details</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Sales Person</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Payment Mode</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Warehouse</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Cost Center</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Price List</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Edit Rate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {settings.sales_person_details.map((person, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{person.sales_person}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{person.user}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{person.mode_of_payment}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{person.warehouse}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{person.cost_center}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{person.price_list}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{person.edit_item_rate === 1 ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Portal>
  );
};

export default POSSettingsModal;
