import React, { useRef } from 'react';
import { X, Printer, CheckCircle, Navigation } from 'lucide-react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  load: any;
  companySettings: any;
  onMarkInvoiced: () => void;
}

export default function InvoiceModal({ isOpen, onClose, load, companySettings, onMarkInvoiced }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !load) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceNumber = `INV-${load.load_number}`;
  const todayDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const baseRate = load.rate || 0;
  const unforeseen = load.additional_expenses || 0;
  const totalAmount = baseRate + unforeseen;

  const cName = companySettings?.company_name || 'Northstar Freight Logistics';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 print:p-0 print:bg-white">
      
      {/* Modal Container */}
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl max-h-full flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black print:h-auto print:max-h-none">
        
        {/* Header - Hidden during print */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40 print:hidden">
          <h2 className="text-xl font-bold text-white flex items-center">
            <span className="bg-primary/20 text-primary p-2 rounded-lg mr-3">
              <Navigation className="w-5 h-5" />
            </span>
            Invoice Generator
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition p-2 hover:bg-white/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Invoice Content - Scrollable on web, static on print */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-100 print:p-0 print:overflow-visible">
          
          {/* Printable Area */}
          <div 
            ref={invoiceRef}
            className="bg-white text-black p-10 max-w-3xl mx-auto shadow-lg print:shadow-none print:max-w-none print:w-full print:p-0"
          >
            
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-200 pb-8 mb-8">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-1">{cName}</h1>
                <p className="text-sm text-gray-500 font-medium italic">Delivering by Precision, Driven by Trust</p>
                <div className="mt-4 text-sm text-gray-600 space-y-1">
                  <p className="font-bold text-gray-800">Diego Moya - Operations Manager</p>
                  <p>2400 Windsprint Way, Apt 1314</p>
                  <p>Arlington, TX 76014</p>
                  <p>MC: 1761346 | DOT: 4464928</p>
                  <p>Phone: (682) 372-2498</p>
                  <p>Email: info@northstarfreightlogistics.com</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-4xl font-light text-gray-400 mb-4 tracking-widest uppercase">Invoice</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-gray-500 font-bold uppercase tracking-wider">Invoice #</div>
                  <div className="font-semibold text-gray-900">{invoiceNumber}</div>
                  <div className="text-gray-500 font-bold uppercase tracking-wider">Date</div>
                  <div className="font-semibold text-gray-900">{todayDate}</div>
                  <div className="text-gray-500 font-bold uppercase tracking-wider">Terms</div>
                  <div className="font-semibold text-gray-900">Net 30</div>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-10">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Bill To</h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <p className="text-xl font-bold text-gray-900 mb-1">{load.broker_name || 'N/A'}</p>
                {load.broker_mc && <p className="text-sm text-gray-600 font-medium">MC: {load.broker_mc}</p>}
                <p className="text-sm text-gray-500 mt-2">Attn: Accounts Payable</p>
              </div>
            </div>

            {/* Load Details Summary */}
            <div className="mb-10">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Load Details</h3>
              <div className="flex flex-wrap gap-y-4 border-y border-gray-200 py-4">
                <div className="w-1/3">
                  <span className="block text-xs text-gray-500 font-bold uppercase">Load Reference</span>
                  <span className="block font-semibold text-gray-900">{load.load_number}</span>
                </div>
                <div className="w-1/3">
                  <span className="block text-xs text-gray-500 font-bold uppercase">Driver</span>
                  <span className="block font-semibold text-gray-900">
                    {load.users ? `${load.users.first_name} ${load.users.last_name}` : 'N/A'}
                  </span>
                </div>
                <div className="w-1/3">
                  <span className="block text-xs text-gray-500 font-bold uppercase">Weight</span>
                  <span className="block font-semibold text-gray-900">{load.weight ? `${load.weight.toLocaleString()} lbs` : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Stops / Itinerary */}
            <div className="mb-10">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Itinerary</h3>
              <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                
                {/* Pickup */}
                <div className="relative pl-6">
                  <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7.5px] top-1.5 border-2 border-white"></div>
                  <div className="text-xs font-bold text-gray-400 uppercase">Pickup Origin</div>
                  <div className="font-bold text-gray-900">{load.pickup_location}</div>
                  {load.pickup_date && <div className="text-sm text-gray-500">{load.pickup_date}</div>}
                </div>

                {/* Additional Stops */}
                {load.stops && load.stops.map((stop: any, idx: number) => (
                  <div key={idx} className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7.5px] top-1.5 border-2 border-white"></div>
                    <div className="text-xs font-bold text-gray-400 uppercase">Stop {idx + 1}: {stop.type}</div>
                    <div className="font-bold text-gray-900">{stop.location}</div>
                    {stop.date && <div className="text-sm text-gray-500">{stop.date}</div>}
                  </div>
                ))}

                {/* Delivery */}
                <div className="relative pl-6">
                  <div className="absolute w-3 h-3 bg-gray-900 rounded-full -left-[7.5px] top-1.5 border-2 border-white"></div>
                  <div className="text-xs font-bold text-gray-900 uppercase">Delivery Destination</div>
                  <div className="font-bold text-gray-900">{load.delivery_location}</div>
                  {load.delivery_date && <div className="text-sm text-gray-500">{load.delivery_date}</div>}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-10">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="py-3 text-sm font-bold text-gray-500 uppercase tracking-widest">Description</th>
                    <th className="py-3 text-sm font-bold text-gray-500 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-4 font-semibold text-gray-900">Linehaul Freight Charge</td>
                    <td className="py-4 font-semibold text-gray-900 text-right">${baseRate.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                  {unforeseen > 0 && (
                    <tr>
                      <td className="py-4 font-medium text-gray-600">Accessorials / Unforeseen Expenses</td>
                      <td className="py-4 font-medium text-gray-600 text-right">${unforeseen.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-900">
                    <td className="py-4 text-right font-bold text-gray-500 uppercase tracking-widest">Total Due</td>
                    <td className="py-4 text-right text-3xl font-black text-gray-900">${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer / Remittance */}
            <div className="mt-16 text-center text-sm text-gray-500 border-t border-gray-200 pt-8">
              <p className="font-bold text-gray-900 mb-1">Please remit payment to:</p>
              <p>{cName}</p>
              <p>Thank you for your business!</p>
            </div>

          </div>
        </div>

        {/* Footer Actions - Hidden during print */}
        <div className="p-6 border-t border-white/10 bg-black/40 flex justify-between items-center print:hidden">
          <button 
            onClick={handlePrint}
            className="flex items-center px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition"
          >
            <Printer className="w-5 h-5 mr-2" />
            Print / Save as PDF
          </button>

          <button 
            onClick={() => {
              onMarkInvoiced();
              onClose();
            }}
            className="flex items-center px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-500 transition shadow-[0_0_15px_rgba(147,51,234,0.4)]"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Mark Load as Invoiced
          </button>
        </div>

      </div>
    </div>
  );
}
