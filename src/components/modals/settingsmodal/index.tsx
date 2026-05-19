export default function SettingsModal() {
  return null
}
















// import React from 'react';
// import InputField from '../../ui/input';
// import Button from '../../ui/buttom';

// interface Props {
//   onClose?: () => void;
// }

// const SettingsModal: React.FC<Props> = ({ onClose }) => {
//   // single-tab modal for now (Print Settings)
//   const [type, setType] = React.useState<string>('Sale');
//   const [name, setName] = React.useState<string>('');
//   const [directPrint, setDirectPrint] = React.useState<boolean>(false);
//   const [printPdf, setPrintPdf] = React.useState<boolean>(false);
//   const [fromWeb, setFromWeb] = React.useState<boolean>(false);
//   const [selectionPopup, setSelectionPopup] = React.useState<boolean>(false);
//   const [printer, setPrinter] = React.useState<string>('');
//   const [pdfPath, setPdfPath] = React.useState<string>('');
//   const [template, setTemplate] = React.useState<string>('');
//   const [templateSelect, setTemplateSelect] = React.useState<string>('All');
//   const [printCategory, setPrintCategory] = React.useState<string>('');
//   const [designMode, setDesignMode] = React.useState<boolean>(false);

//   const sampleRows = [
//     { type: 'Sale', name: 'saleinv', print: 'Accounts', direct: true, pdf: false },
//     { type: 'Order', name: 'saleorder', print: 'Accounts', direct: false, pdf: false },
//     { type: 'Sale', name: 'sale a4', print: 'HP983293 (HP S...)', direct: false, pdf: true },
//   ];

//   return (
//     <div className="w-[900px] max-w-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
//       <div className="p-5">
//         <div className="space-y-4">
//           <div className="grid grid-cols-2 gap-4">
//             <div className="space-y-2">
//               <label className="text-sm font-medium">Type</label>
//               <select
//                 value={type}
//                 onChange={(e) => setType(e.target.value)}
//                 className="w-full px-3 py-2 border rounded-md"
//               >
//                 <option>Sale</option>
//                 <option>Order</option>
//                 <option>Quotation</option>
//               </select>
//             </div>

//             <div className="space-y-2">
//               <label className="text-sm font-medium">Name</label>
//               <InputField value={name} onChange={(e) => setName(e.target.value)} />
//             </div>

//             <div className="space-y-2">
//               <label className="text-sm font-medium">Flags</label>
//               <div className="flex flex-col gap-2">
//                 <div className="flex items-center gap-2">
//                   <input
//                     id="directPrint"
//                     type="checkbox"
//                     checked={directPrint}
//                     onChange={(e) => setDirectPrint(e.target.checked)}
//                     className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
//                   />
//                   <label htmlFor="directPrint" className="text-sm font-medium text-gray-700 cursor-pointer">Direct Print</label>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <input
//                     id="printPdf"
//                     type="checkbox"
//                     checked={printPdf}
//                     onChange={(e) => setPrintPdf(e.target.checked)}
//                     className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
//                   />
//                   <label htmlFor="printPdf" className="text-sm font-medium text-gray-700 cursor-pointer">Print PDF</label>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <input
//                     id="fromWeb"
//                     type="checkbox"
//                     checked={fromWeb}
//                     onChange={(e) => setFromWeb(e.target.checked)}
//                     className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
//                   />
//                   <label htmlFor="fromWeb" className="text-sm font-medium text-gray-700 cursor-pointer">From Web</label>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <input
//                     id="selectionPopup"
//                     type="checkbox"
//                     checked={selectionPopup}
//                     onChange={(e) => setSelectionPopup(e.target.checked)}
//                     className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
//                   />
//                   <label htmlFor="selectionPopup" className="text-sm font-medium text-gray-700 cursor-pointer">Selection Popup</label>
//                 </div>
//               </div>
//             </div>

//             <div className="space-y-2">
//               <label className="text-sm font-medium">Printer</label>
//               <select value={printer} onChange={(e) => setPrinter(e.target.value)} className="w-full px-3 py-2 border rounded-md">
//                 <option value="">(Default)</option>
//                 <option>HP983293 (HP S...)</option>
//                 <option>Accounts</option>
//               </select>
//             </div>

//             <div className="space-y-2">
//               <label className="text-sm font-medium">PDF Path</label>
//               <InputField value={pdfPath} onChange={(e) => setPdfPath(e.target.value)} />
//             </div>

//             <div className="space-y-2">
//               <label className="text-sm font-medium">Template</label>
//               <InputField value={template} onChange={(e) => setTemplate(e.target.value)} />
//             </div>

//             <div className="space-y-2">
//               <label className="text-sm font-medium">Template Select</label>
//               <select value={templateSelect} onChange={(e) => setTemplateSelect(e.target.value)} className="w-full px-3 py-2 border rounded-md">
//                 <option>All</option>
//                 <option>Small</option>
//                 <option>Large</option>
//               </select>
//             </div>

//             <div className="space-y-2">
//               <label className="text-sm font-medium">Print Category</label>
//               <InputField value={printCategory} onChange={(e) => setPrintCategory(e.target.value)} />
//             </div>
//           </div>

//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <input
//                 id="designMode"
//                 type="checkbox"
//                 checked={designMode}
//                 onChange={(e) => setDesignMode(e.target.checked)}
//                 className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
//               />
//               <label htmlFor="designMode" className="text-sm font-medium text-gray-700 cursor-pointer">Design Mode</label>
//             </div>
//             <Button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-md">SAVE</Button>
//           </div>

//           <div className="border rounded-md overflow-auto">
//             <table className="min-w-full text-sm">
//               <thead className="bg-gray-100">
//                 <tr>
//                   <th className="px-3 py-2 text-left">Type</th>
//                   <th className="px-3 py-2 text-left">Name</th>
//                   <th className="px-3 py-2 text-left">Print</th>
//                   <th className="px-3 py-2 text-left">Direct Print</th>
//                   <th className="px-3 py-2 text-left">Print PDF</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {sampleRows.map((r, i) => (
//                   <tr key={i} className="odd:bg-white even:bg-gray-50">
//                     <td className="px-3 py-2">{r.type}</td>
//                     <td className="px-3 py-2">{r.name}</td>
//                     <td className="px-3 py-2">{r.print}</td>
//                     <td className="px-3 py-2">{r.direct ? '✔' : ''}</td>
//                     <td className="px-3 py-2">{r.pdf ? '✔' : ''}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {/* other tabs removed - only Print Settings present */}
//       </div>
//     </div>
//   );
// };

// export default SettingsModal;
