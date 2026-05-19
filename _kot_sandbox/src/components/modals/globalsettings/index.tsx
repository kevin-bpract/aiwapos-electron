import React, { useState, useEffect } from 'react';
import { RefreshCw, Layout, Printer, Settings, Download } from 'lucide-react';
import { toast } from 'sonner';
import { PRINTER_SETTINGS_CHANGED } from '../../../constants/printerSettingsEvents';
import {
  fetchAndCacheTemplate,
  getCachedTemplate,
  type ReceiptFormat,
} from '../../../utils/clientSidePrint';
import {
  fetchAndCacheSessionReportTemplate,
  getCachedSessionReportTemplate,
} from '../../../utils/sessionReportPrint';

interface Props {
  onClose?: () => void;
  onSave?: (settings: any) => void;
}

const GlobalSettingsModal: React.FC<Props> = ({ onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'printing' | 'appearance' | 'advanced'
  >('general');
  const [appVersion, setAppVersion] = useState<string>('');

  const [generalSettings, setGeneralSettings] = useState({
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    currency: 'USD',
    timeZone: 'UTC',
    onScreenKeyboardEnabled: false,
  });

  const [appearanceSettings, setAppearanceSettings] = useState({
    scale: 1,
    fontSize: 14, // Default font size
  });

  const [printingSettings, setPrintingSettings] = useState({
    selectedPrinter: '',
    invoicePrinter: '',
    kotPrinter: '',
    useSeparatePrinters: false,
    printerType: 'pdf' as 'pdf' | 'pos',
    posPrinterWidth: '80mm' as '58mm' | '80mm',
    paperSize: 'A4',
    autoprint: false,
    printCopies: 1,
    categoryPrinters: {} as Record<string, string>,
    printMethod: 'native' as 'native' | 'qz-tray' | 'html',
    invoicePrintFormat: '',
    orderPrintFormat: '',
    pdfPrintScale: 'fit' as 'fit' | 'noscale',
    printFirstPageOnly: true,
  });

  const [advancedSettings, setAdvancedSettings] = useState({
    enableNotifications: true,
    enableSound: true,
    darkMode: false,
    autoBackup: true,
  });

  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [printFormats, setPrintFormats] = useState<string[]>([]);

  const [orderPrintformats, setOrderPrintFormats] = useState<string[]>([]);

  const [loadingPrintFormats, setLoadingPrintFormats] = useState(false);

  // Client-side printing state
  const [clientSidePrinting, setClientSidePrinting] = useState({
    enabled: false,
    format: 'standard' as ReceiptFormat,
  });
  const [templateCached, setTemplateCached] = useState<Record<string, boolean>>({
    standard: false,
    compact: false,
  });
  const [fetchingTemplate, setFetchingTemplate] = useState(false);

  // Session report client-side printing state
  const [sessionReportClientPrint, setSessionReportClientPrint] = useState(false);
  const [sessionReportTemplateCached, setSessionReportTemplateCached] = useState(false);
  const [fetchingSessionReportTemplate, setFetchingSessionReportTemplate] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch available printers and saved settings on mount
  useEffect(() => {
    const fetchPrintersAndSettings = async () => {
      setLoadingPrinters(true);
      try {
        // Fetch available printers from Windows
        const printers = await window.printers.get();
        setAvailablePrinters(printers || []);

        // Fetch categories
        const itemGroups = await window.itemGroups.getAll();
        if (Array.isArray(itemGroups)) {
          setCategories(itemGroups);
        }

        // Load saved printer settings
        const savedSettings = (await window.printerSettings.get()) as any;
        console.log('Loaded printer settings:', savedSettings);
        if (savedSettings) {
          setGeneralSettings((prev) => ({
            ...prev,
            onScreenKeyboardEnabled:
              savedSettings.onScreenKeyboardEnabled === true,
          }));
          setPrintingSettings((prev) => ({
            ...prev,
            selectedPrinter: savedSettings.printer || '',
            invoicePrinter: savedSettings.invoicePrinter || '',
            kotPrinter: savedSettings.kotPrinter || '',
            useSeparatePrinters: savedSettings.useSeparatePrinters || false,
            printerType: savedSettings.printerType || 'pdf',
            posPrinterWidth: savedSettings.posPrinterWidth || '80mm',
            paperSize: savedSettings.paperSize || 'A4',
            categoryPrinters: savedSettings.categoryPrinters || {},

            autoprint: savedSettings.autoprint || false,
            printMethod: savedSettings.printMethod || 'native',
            invoicePrintFormat: savedSettings.invoicePrintFormat || '',
            orderPrintFormat: savedSettings.orderPrintFormat || '',
            pdfPrintScale:
              savedSettings.pdfPrintScale === 'noscale' ? 'noscale' : 'fit',
            printFirstPageOnly: savedSettings.printFirstPageOnly !== false,
          }));

          if (savedSettings.scale) {
            setAppearanceSettings((prev) => ({
              ...prev,
              scale: savedSettings.scale,
            }));
            try {
              // webFrame.setZoomFactor breaks touch event coordinates in Electron
              // so inputs become un-clickable on touch screens. CSS zoom handles it correctly.
              (document.documentElement as any).style.zoom = savedSettings.scale;
            } catch { }
          }

          if (savedSettings.fontSize) {
            setAppearanceSettings((prev) => ({
              ...prev,
              fontSize: savedSettings.fontSize,
            }));
            document.documentElement.style.fontSize = `${savedSettings.fontSize}px`;
          }
        }
        // Load client-side printing settings
        if (savedSettings) {
          setClientSidePrinting({
            enabled: savedSettings.clientSidePrintEnabled || false,
            format: savedSettings.clientSidePrintFormat || 'standard',
          });
        }
        // Check which templates are cached
        const [stdCached, compactCached, sessionRptCached] = await Promise.all([
          getCachedTemplate('standard'),
          getCachedTemplate('compact'),
          getCachedSessionReportTemplate(),
        ]);
        setTemplateCached({
          standard: !!stdCached,
          compact: !!compactCached,
        });
        // Session report settings
        if (savedSettings) {
          setSessionReportClientPrint(savedSettings.sessionReportClientPrintEnabled || false);
        }
        setSessionReportTemplateCached(!!sessionRptCached);

        // Fetch print formats
        try {
          setLoadingPrintFormats(true);
          const formatsRes = await window.api.get(
            '/api/method/pos_api.api.get_print_formats?doctype_name=Sales%20Invoice',
          );
          const invoiceFormats = formatsRes?.message?.print_formats;
          if (Array.isArray(invoiceFormats)) {
            setPrintFormats(invoiceFormats.map((f: any) => f.print_format));
          }

          const orderFormatsRes = await window.api.get(
            '/api/method/pos_api.api.get_print_formats?doctype_name=Sales%20Order',
          );

          const formats = orderFormatsRes?.message?.print_formats;
          if (Array.isArray(formats)) {
            setOrderPrintFormats(formats.map((f: any) => f.print_format));
          }
          console.log('Loaded print formats:', formats, invoiceFormats);
        } catch (formatErr) {
          console.error('Error fetching print formats:', formatErr);
          setLoadingPrintFormats(false);
        }
      } catch (error) {
        console.error('Error fetching printers or settings:', error);
      } finally {
        setLoadingPrinters(false);
        setLoadingPrintFormats(false);
      }
    };

    fetchPrintersAndSettings();

    // Fetch app version
    const fetchVersion = async () => {
      try {
        const version = await window.app.getVersion();
        setAppVersion(version);
      } catch (err) {
        console.error('Failed to fetch app version:', err);
      }
    };
    fetchVersion();
  }, []);

  const refreshPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const printers = await window.printers.get(true); // Force refresh
      setAvailablePrinters(printers || []);
      toast.success('Printers refreshed');
    } catch (error) {
      console.error('Error refreshing printers:', error);
      toast.error('Failed to refresh printers');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleSave = async () => {
    // Save settings
    try {
      await window.printerSettings.save({
        printer: printingSettings.selectedPrinter,
        invoicePrinter: printingSettings.invoicePrinter,
        kotPrinter: printingSettings.kotPrinter,
        useSeparatePrinters: printingSettings.useSeparatePrinters,
        printerType: printingSettings.printerType,
        posPrinterWidth: printingSettings.posPrinterWidth,
        paperSize: printingSettings.paperSize,
        printMethod: printingSettings.printMethod,
        invoicePrintFormat: printingSettings.invoicePrintFormat,
        orderPrintFormat: printingSettings.orderPrintFormat,
        pdfPrintScale: printingSettings.pdfPrintScale,
        printFirstPageOnly: printingSettings.printFirstPageOnly,

        autoprint: printingSettings.autoprint,
        printCopies: printingSettings.printCopies,
        categoryPrinters: printingSettings.categoryPrinters,
        clientSidePrintEnabled: clientSidePrinting.enabled,
        clientSidePrintFormat: clientSidePrinting.format,
        sessionReportClientPrintEnabled: sessionReportClientPrint,
        scale: appearanceSettings.scale,
        fontSize: appearanceSettings.fontSize,
        onScreenKeyboardEnabled: generalSettings.onScreenKeyboardEnabled,
      });
      console.log('Settings saved successfully');
      toast.success('Settings saved successfully');
      window.dispatchEvent(new Event(PRINTER_SETTINGS_CHANGED));

      // Apply font size
      document.documentElement.style.fontSize = `${appearanceSettings.fontSize}px`;
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
      return; // Don't close modal if save failed
    }

    if (onSave) {
      onSave({
        general: generalSettings,
        printing: printingSettings,
        appearance: appearanceSettings,
        advanced: advancedSettings,
      });
    }
    if (onClose) onClose();
  };

  const languages = ['English', 'Spanish', 'French', 'German', 'Chinese'];
  const dateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
  const currencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex flex-col bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-5xl h-[600px] border border-gray-100">
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              Settings
            </h2>
            <p className="text-sm text-gray-500 font-medium">
              Configure your application preferences
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black transition-all shadow-lg shadow-gray-200 text-sm"
            >
              Save Changes
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50/50 border-r border-gray-100 p-4 space-y-2 flex-shrink-0">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'general'
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-100'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <Layout className="w-5 h-5" />
              General
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'appearance'
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-100'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('printing')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'printing'
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-100'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <Printer className="w-5 h-5" />
              Printing
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'advanced'
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-100'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <Settings className="w-5 h-5" />
              Advanced
            </button>

            <div className="mt-auto pt-4 border-t border-gray-100 px-4 pb-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  App Version
                </span>
                <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded-md inline-block">
                  v{appVersion || '...'}
                </span>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            {activeTab === 'general' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">
                      Language
                    </label>
                    <select
                      value={generalSettings.language}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          language: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      {languages.map((lang) => (
                        <option
                          key={lang}
                          value={lang.toLowerCase().slice(0, 2)}
                        >
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">
                      Date Format
                    </label>
                    <select
                      value={generalSettings.dateFormat}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          dateFormat: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      {dateFormats.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">
                      Currency
                    </label>
                    <select
                      value={generalSettings.currency}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          currency: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      {currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">
                      Time Zone
                    </label>
                    <input
                      type="text"
                      value={generalSettings.timeZone}
                      onChange={(e) =>
                        setGeneralSettings({
                          ...generalSettings,
                          timeZone: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={generalSettings.onScreenKeyboardEnabled}
                    onChange={(e) =>
                      setGeneralSettings({
                        ...generalSettings,
                        onScreenKeyboardEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>
                    <span className="text-sm font-semibold text-gray-900">
                      On-screen keyboard
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      Show the touch keyboard on login and restaurant POS. You can
                      minimize it from the bar when typing.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Screen Scaling */}
                <div className="space-y-4 pt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-gray-900">
                      Screen Scaling
                    </label>
                    <span className="text-sm font-medium text-gray-600">
                      {Math.round((appearanceSettings.scale || 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={appearanceSettings.scale || 1}
                    onChange={(e) => {
                      const scale = parseFloat(e.target.value);
                      setAppearanceSettings({ ...appearanceSettings, scale });
                      // Apply immediately for preview
                      try {
                        (document.documentElement as any).style.zoom = scale;
                      } catch (err) {
                        console.error('Failed to set CSS zoom:', err);
                      }
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>50%</span>
                    <span>100%</span>
                    <span>150%</span>
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-gray-900">
                      Base Font Size
                    </label>
                    <span className="text-sm font-medium text-gray-600">
                      {appearanceSettings.fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="20"
                    step="1"
                    value={appearanceSettings.fontSize || 16}
                    onChange={(e) => {
                      const fontSize = parseInt(e.target.value);
                      setAppearanceSettings({
                        ...appearanceSettings,
                        fontSize,
                      });
                      // Apply immediately for preview
                      document.documentElement.style.fontSize = `${fontSize}px`;
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Small (12px)</span>
                    <span>Normal (14-16px)</span>
                    <span>Large (20px)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Adjusting this will change the size of text and UI elements
                    relative to the scale.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'printing' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Mode Selection */}
                <div className="bg-gray-50 p-1.5 rounded-2xl flex relative">
                  <div
                    className="absolute inset-y-1.5 w-1/2 bg-white shadow-sm rounded-xl transition-all duration-300 ease-out"
                    style={{
                      left:
                        printingSettings.printerType === 'pdf'
                          ? '0.375rem'
                          : '50%',
                    }}
                  />
                  <button
                    className={`flex-1 relative z-10 py-2.5 text-sm font-bold rounded-xl transition-colors ${printingSettings.printerType === 'pdf'
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                    onClick={() =>
                      setPrintingSettings((s) => ({ ...s, printerType: 'pdf' }))
                    }
                  >
                    Standard (PDF)
                  </button>
                  <button
                    className={`flex-1 relative z-10 py-2.5 text-sm font-bold rounded-xl transition-colors ${printingSettings.printerType === 'pos'
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                    onClick={() =>
                      setPrintingSettings((s) => ({ ...s, printerType: 'pos' }))
                    }
                  >
                    POS (Thermal)
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Printing Backend Selection */}
                  <div
                    className={`bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-6 transition-opacity ${clientSidePrinting.enabled ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <h4 className="text-sm font-bold text-blue-900 mb-3">
                      Printing Backend (Server-Rendered)
                    </h4>
                    <div className="flex gap-4">
                      {[
                        { id: 'native', label: 'Native (SumatraPDF)' },
                        { id: 'qz-tray', label: 'QZ Tray' },
                        { id: 'html', label: 'Server HTML' },
                      ].map((method) => (
                        <label
                          key={method.id}
                          className="flex items-center gap-3 cursor-pointer group p-3 bg-white border border-blue-100 rounded-xl hover:border-blue-300 transition-all flex-1 shadow-sm"
                        >
                          <input
                            type="radio"
                            name="printMethod"
                            disabled={clientSidePrinting.enabled}
                            checked={printingSettings.printMethod === method.id}
                            onChange={() =>
                              setPrintingSettings((s) => ({
                                ...s,
                                printMethod: method.id as any,
                              }))
                            }
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-gray-700">
                            {method.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    {clientSidePrinting.enabled ? (
                      <p className="text-xs text-amber-700 mt-2 font-medium">
                        Disabled — Client-Side Printing is active below. Turn it off to use a server-rendered backend.
                      </p>
                    ) : (
                      printingSettings.printMethod === 'qz-tray' && (
                        <p className="text-xs text-blue-600 mt-2 font-medium">
                          Requires QZ Tray application to be running on this PC.
                        </p>
                      )
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      Format Configuration
                    </h3>
                  </div>

                  {loadingPrintFormats ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-gray-600">
                        Loading print formats...
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 border border-gray-100 rounded-2xl space-y-5 bg-white shadow-sm mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Invoice Print Format
                          </label>
                          <select
                            value={printingSettings.invoicePrintFormat}
                            onChange={(e) =>
                              setPrintingSettings((s) => ({
                                ...s,
                                invoicePrintFormat: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                          >
                            <option value="">Default (POS Invoice)</option>
                            {printFormats.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Order Print Format
                          </label>
                          <select
                            value={printingSettings.orderPrintFormat}
                            onChange={(e) =>
                              setPrintingSettings((s) => ({
                                ...s,
                                orderPrintFormat: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                          >
                            <option value="">Default (POS Invoice)</option>
                            {orderPrintformats.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      Printer Configuration
                    </h3>
                    <button
                      onClick={refreshPrinters}
                      className="text-sm text-blue-600 font-semibold hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${loadingPrinters ? 'animate-spin' : ''}`}
                      />
                      Refresh List
                    </button>
                  </div>

                  {availablePrinters.length === 0 && !loadingPrinters && (
                    <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-sm font-medium flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      No available printers detected. Please check your system
                      settings.
                    </div>
                  )}

                  <div className="p-5 border border-gray-100 rounded-2xl space-y-5 bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${printingSettings.useSeparatePrinters ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}
                        >
                          {printingSettings.useSeparatePrinters && (
                            <Settings className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={printingSettings.useSeparatePrinters}
                          onChange={(e) =>
                            setPrintingSettings((s) => ({
                              ...s,
                              useSeparatePrinters: e.target.checked,
                            }))
                          }
                        />
                        <span className="font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                          Separate Invoice & KOT Printers
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-1 gap-6 pt-2">
                      {printingSettings.useSeparatePrinters ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                              Invoice Printer
                            </label>
                            <select
                              value={printingSettings.invoicePrinter}
                              onChange={(e) =>
                                setPrintingSettings((s) => ({
                                  ...s,
                                  invoicePrinter: e.target.value,
                                }))
                              }
                              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                            >
                              <option value="">Select Printer</option>
                              {availablePrinters.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-bold text-gray-900 mb-4">
                              Kitchen Printer Configuration
                            </h4>

                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                  Default Kitchen/KOT Printer
                                </label>
                                <select
                                  value={printingSettings.kotPrinter}
                                  onChange={(e) =>
                                    setPrintingSettings((s) => ({
                                      ...s,
                                      kotPrinter: e.target.value,
                                    }))
                                  }
                                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                                >
                                  <option value="">Select Printer</option>
                                  {availablePrinters.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs text-gray-400">
                                  Used for categories without a specific printer
                                  assigned
                                </p>
                              </div>

                              <div className="space-y-3 pt-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                  Category Specific Printers
                                </label>
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                  {categories.map((cat) => (
                                    <div
                                      key={cat.name}
                                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                                    >
                                      <span className="text-sm font-medium text-gray-700">
                                        {cat.name}
                                      </span>
                                      <select
                                        value={
                                          printingSettings.categoryPrinters?.[
                                          cat.name
                                          ] || ''
                                        }
                                        onChange={(e) =>
                                          setPrintingSettings((s) => ({
                                            ...s,
                                            categoryPrinters: {
                                              ...s.categoryPrinters,
                                              [cat.name]: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-48 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                      >
                                        <option value="">Use Default</option>
                                        {availablePrinters.map((p) => (
                                          <option key={p} value={p}>
                                            {p}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                  {categories.length === 0 && (
                                    <div className="text-sm text-gray-400 text-center py-4">
                                      No categories found
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Default Printer
                          </label>
                          <select
                            value={printingSettings.selectedPrinter}
                            onChange={(e) =>
                              setPrintingSettings((s) => ({
                                ...s,
                                selectedPrinter: e.target.value,
                              }))
                            }
                            className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                          >
                            <option value="">Select Printer</option>
                            {availablePrinters.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {printingSettings.printerType === 'pdf' && (
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-gray-900">
                        PDF Paper Size
                      </label>
                      <div className="flex gap-4">
                        {['A4', '80mm'].map((size) => (
                          <label
                            key={size}
                            className="flex items-center gap-3 cursor-pointer group p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all flex-1"
                          >
                            <input
                              type="radio"
                              name="paperSize"
                              checked={printingSettings.paperSize === size}
                              onChange={() =>
                                setPrintingSettings((s) => ({
                                  ...s,
                                  paperSize: size as any,
                                }))
                              }
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-semibold text-gray-700">
                              {size}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Select "80mm" for thermal printers using PDF driver, or
                        "A4" for standard printers.
                      </p>
                    </div>
                  )}

                  {printingSettings.printerType === 'pdf' && (
                    <div className="space-y-3 pt-2">
                      <label className="text-sm font-semibold text-gray-900">
                        PDF print scale
                      </label>
                      <div className="flex gap-4">
                        {[
                          { id: 'fit' as const, label: 'Fit (default)' },
                          { id: 'noscale' as const, label: 'No scale' },
                        ].map((opt) => (
                          <label
                            key={opt.id}
                            className="flex items-center gap-3 cursor-pointer group p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all flex-1"
                          >
                            <input
                              type="radio"
                              name="pdfPrintScale"
                              checked={
                                printingSettings.pdfPrintScale === opt.id
                              }
                              onChange={() =>
                                setPrintingSettings((s) => ({
                                  ...s,
                                  pdfPrintScale: opt.id,
                                }))
                              }
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-semibold text-gray-700">
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Scale PDF to fit paper, or print at original size (no
                        scale).
                      </p>
                      <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-gray-50 rounded-lg transition-all mt-2">
                        <input
                          type="checkbox"
                          checked={printingSettings.printFirstPageOnly}
                          onChange={(e) =>
                            setPrintingSettings((s) => ({
                              ...s,
                              printFirstPageOnly: e.target.checked,
                            }))
                          }
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">
                            Print first page only
                          </p>
                          <p className="text-xs text-gray-500">
                            Useful for thermal: print only page 1 of multi-page
                            invoice PDFs (e.g. one slip instead of three).
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {printingSettings.printerType === 'pos' && (
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-gray-900">
                        POS Paper Width
                      </label>
                      <div className="flex gap-4">
                        {['58mm', '80mm'].map((size) => (
                          <label
                            key={size}
                            className="flex items-center gap-3 cursor-pointer group p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all flex-1"
                          >
                            <input
                              type="radio"
                              name="posWidth"
                              checked={
                                printingSettings.posPrinterWidth === size
                              }
                              onChange={() =>
                                setPrintingSettings((s) => ({
                                  ...s,
                                  posPrinterWidth: size as any,
                                }))
                              }
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-semibold text-gray-700">
                              {size}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Client-Side Printing */}
                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      Client-Side Printing
                    </h3>
                    <p className="text-xs text-gray-500">
                      Faster printing by rendering receipts locally using a cached HTML template instead of fetching a PDF from the server.
                    </p>

                    <label className="flex items-center gap-3 cursor-pointer group p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                      <input
                        type="checkbox"
                        checked={clientSidePrinting.enabled}
                        onChange={(e) =>
                          setClientSidePrinting((s) => ({
                            ...s,
                            enabled: e.target.checked,
                          }))
                        }
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          Enable Client-Side Printing
                        </p>
                        <p className="text-xs text-gray-500">
                          Use local HTML templates for invoice printing (faster, works offline once cached)
                        </p>
                      </div>
                    </label>

                    {clientSidePrinting.enabled && (
                      <div className="space-y-4 pl-1">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                            Receipt Format
                          </label>
                          <div className="flex gap-4">
                            {(['standard', 'compact'] as ReceiptFormat[]).map((fmt) => (
                              <label
                                key={fmt}
                                className="flex items-center gap-3 cursor-pointer group p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all flex-1"
                              >
                                <input
                                  type="radio"
                                  name="clientSideFormat"
                                  checked={clientSidePrinting.format === fmt}
                                  onChange={() =>
                                    setClientSidePrinting((s) => ({
                                      ...s,
                                      format: fmt,
                                    }))
                                  }
                                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="font-semibold text-gray-700 capitalize">
                                    {fmt}
                                  </span>
                                  {templateCached[fmt] && (
                                    <span className="ml-2 text-xs text-green-600 font-medium">
                                      Cached
                                    </span>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            disabled={fetchingTemplate}
                            onClick={async () => {
                              setFetchingTemplate(true);
                              try {
                                await fetchAndCacheTemplate(clientSidePrinting.format);
                                setTemplateCached((prev) => ({
                                  ...prev,
                                  [clientSidePrinting.format]: true,
                                }));
                                toast.success(`${clientSidePrinting.format} template cached`);
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to fetch template');
                              } finally {
                                setFetchingTemplate(false);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all text-sm disabled:opacity-50"
                          >
                            <Download className={`w-4 h-4 ${fetchingTemplate ? 'animate-bounce' : ''}`} />
                            {fetchingTemplate ? 'Fetching...' : `Fetch ${clientSidePrinting.format} template`}
                          </button>

                          <button
                            type="button"
                            disabled={fetchingTemplate}
                            onClick={async () => {
                              setFetchingTemplate(true);
                              try {
                                await Promise.all([
                                  fetchAndCacheTemplate('standard'),
                                  fetchAndCacheTemplate('compact'),
                                ]);
                                setTemplateCached({ standard: true, compact: true });
                                toast.success('All templates cached');
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to fetch templates');
                              } finally {
                                setFetchingTemplate(false);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all text-sm disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${fetchingTemplate ? 'animate-spin' : ''}`} />
                            Fetch All
                          </button>
                        </div>

                        {!templateCached[clientSidePrinting.format] && (
                          <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-sm font-medium flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            Template not yet cached. Fetch it before printing.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Client-Side Session Report Printing */}
                  <div className="pt-4 border-t border-gray-100 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      Client-Side Session Report
                    </h3>
                    <p className="text-xs text-gray-500">
                      Faster session report printing by rendering locally using a cached HTML template and report data, instead of fetching pre-rendered HTML from the server.
                    </p>

                    <label className="flex items-center gap-3 cursor-pointer group p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                      <input
                        type="checkbox"
                        checked={sessionReportClientPrint}
                        onChange={(e) =>
                          setSessionReportClientPrint(e.target.checked)
                        }
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          Enable Client-Side Session Report
                        </p>
                        <p className="text-xs text-gray-500">
                          Use a locally cached template for session closing reports (faster, works offline once cached)
                        </p>
                      </div>
                    </label>

                    {sessionReportClientPrint && (
                      <div className="space-y-4 pl-1">
                        <div className="flex gap-3 items-center">
                          <button
                            type="button"
                            disabled={fetchingSessionReportTemplate}
                            onClick={async () => {
                              setFetchingSessionReportTemplate(true);
                              try {
                                await fetchAndCacheSessionReportTemplate();
                                setSessionReportTemplateCached(true);
                                toast.success('Session report template cached');
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to fetch session report template');
                              } finally {
                                setFetchingSessionReportTemplate(false);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all text-sm disabled:opacity-50"
                          >
                            <Download className={`w-4 h-4 ${fetchingSessionReportTemplate ? 'animate-bounce' : ''}`} />
                            {fetchingSessionReportTemplate ? 'Fetching...' : 'Fetch Template'}
                          </button>
                          {sessionReportTemplateCached && (
                            <span className="text-xs text-green-600 font-medium">
                              Cached
                            </span>
                          )}
                        </div>

                        {!sessionReportTemplateCached && (
                          <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-yellow-800 text-sm font-medium flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            Template not yet cached. Fetch it before closing a session.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <label className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-gray-50 rounded-lg transition-all">
                      <input
                        type="checkbox"
                        checked={printingSettings.autoprint}
                        onChange={(e) =>
                          setPrintingSettings((s) => ({
                            ...s,
                            autoprint: e.target.checked,
                          }))
                        }
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          Enable Auto-Print
                        </p>
                        <p className="text-xs text-gray-500">
                          Automatically print invoices and KOTs upon checkout
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Advanced Preferences
                </h3>
                {[
                  {
                    key: 'enableNotifications',
                    label: 'System Notifications',
                    desc: 'Receive real-time alerts and updates',
                  },
                  // { key: 'enableSound', label: 'Sound Effects', desc: 'Play sounds for actions like checkout completion' },
                  // { key: 'darkMode', label: 'Dark Mode', desc: 'Switch to a darker theme for low-light environments' },
                  {
                    key: 'autoBackup',
                    label: 'Automatic Backups',
                    desc: 'Backup your data daily to prevent loss',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer transition-all group"
                  >
                    <div>
                      <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                    <div
                      className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ${advancedSettings[item.key as keyof typeof advancedSettings] ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${advancedSettings[item.key as keyof typeof advancedSettings] ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={
                        !!advancedSettings[
                        item.key as keyof typeof advancedSettings
                        ]
                      }
                      onChange={(e) =>
                        setAdvancedSettings((s) => ({
                          ...s,
                          [item.key]: e.target.checked,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettingsModal;
