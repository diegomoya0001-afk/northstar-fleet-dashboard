"use client";

import React, { useState, useEffect } from 'react';
import { FileBarChart, Upload, Calculator, Save, Trash2, Edit2, AlertCircle, Search, Download, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PinModal from '@/components/PinModal';

// Current generic IFTA Tax rates (USD per Gallon)
const DEFAULT_TAX_RATES: Record<string, number> = {
  AL: 0.29, AZ: 0.26, AR: 0.225, CA: 0.864, CO: 0.205, CT: 0.492, DE: 0.22,
  FL: 0.361, GA: 0.312, ID: 0.32, IL: 0.545, IN: 0.55, IA: 0.325, KS: 0.26,
  KY: 0.228, LA: 0.20, ME: 0.312, MD: 0.477, MA: 0.24, MI: 0.505, MN: 0.285,
  MS: 0.18, MO: 0.29, MT: 0.297, NE: 0.29, NV: 0.27, NH: 0.222, NJ: 0.491,
  NM: 0.21, NY: 0.40, NC: 0.404, ND: 0.23, OH: 0.47, OK: 0.14, OR: 0.00, // OR is weight-mile
  PA: 0.741, RI: 0.37, SC: 0.28, SD: 0.28, TN: 0.27, TX: 0.20, UT: 0.345,
  VT: 0.32, VA: 0.29, WA: 0.494, WV: 0.357, WI: 0.329, WY: 0.24
};

const STATE_MAP: Record<string, string> = {
  "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR", "CALIFORNIA": "CA",
  "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE", "FLORIDA": "FL", "GEORGIA": "GA",
  "HAWAII": "HI", "IDAHO": "ID", "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA",
  "KANSAS": "KS", "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
  "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS",
  "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV", "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK", "OREGON": "OR", "PENNSYLVANIA": "PA",
  "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", "TENNESSEE": "TN",
  "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT", "VIRGINIA": "VA", "WASHINGTON": "WA",
  "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY", "DISTRICT OF COLUMBIA": "DC"
};

export default function IFTAPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tax Rates State
  const [taxRates, setTaxRates] = useState(DEFAULT_TAX_RATES);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [tempRates, setTempRates] = useState<Record<string, number>>({});

  // Security
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<Function | null>(null);

  // Upload & Calculation State
  const [quarter, setQuarter] = useState('Q2');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    const { data, error } = await supabase.from('ifta_reports').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setReports(data);
    }
    setLoading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
      setParsedData(null);
    }
  }

  async function handleCalculate() {
    if (!csvFile) return alert("Please upload a CSV file from Motive.");
    
    setCalculating(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV file is empty or invalid.");

      // Parse Headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      let stateIndex = headers.findIndex(h => h.includes('state') || h.includes('jurisdiction'));
      let distanceIndex = headers.findIndex(h => h.includes('distance') || h.includes('miles'));

      if (stateIndex === -1 || distanceIndex === -1) {
        throw new Error("Could not find 'State/Jurisdiction' or 'Distance/Miles' columns in the CSV.");
      }

      // Aggregate miles by state from CSV
      const milesByState: Record<string, number> = {};
      let totalMiles = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (cols.length > Math.max(stateIndex, distanceIndex)) {
          let stateName = cols[stateIndex].toUpperCase();
          let state = STATE_MAP[stateName] || (stateName.length === 2 ? stateName : null);
          const miles = parseFloat(cols[distanceIndex].replace(/[^0-9.-]+/g, '')) || 0;
          if (state && miles > 0) {
            milesByState[state] = (milesByState[state] || 0) + miles;
            totalMiles += miles;
          }
        }
      }

      // Fetch Fuel Logs for the Quarter
      const qStartMonth = quarter === 'Q1' ? 0 : quarter === 'Q2' ? 3 : quarter === 'Q3' ? 6 : 9;
      const startDate = new Date(parseInt(year), qStartMonth, 1).toISOString();
      const endDate = new Date(parseInt(year), qStartMonth + 3, 0, 23, 59, 59).toISOString();

      const { data: fuelLogs, error } = await supabase
        .from('fuel_logs')
        .select('state, gallons')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw new Error("Error fetching fuel logs: " + error.message);

      const fuelByState: Record<string, number> = {};
      let totalGallons = 0;

      fuelLogs?.forEach(log => {
        const st = log.state?.toUpperCase() || 'UNKNOWN';
        const gal = Number(log.gallons) || 0;
        fuelByState[st] = (fuelByState[st] || 0) + gal;
        totalGallons += gal;
      });

      // Avoid division by zero
      const mpg = totalGallons > 0 ? (totalMiles / totalGallons) : 0;

      // Calculate state breakdown
      const breakdown = [];
      let netTaxDue = 0;

      for (const [state, miles] of Object.entries(milesByState)) {
        const galPurchased = fuelByState[state] || 0;
        const taxableGal = mpg > 0 ? (miles / mpg) : 0;
        const netGal = taxableGal - galPurchased;
        const taxRate = taxRates[state] || 0;
        const stateTax = netGal * taxRate;

        breakdown.push({
          state,
          miles,
          gallons_purchased: galPurchased,
          taxable_gallons: taxableGal,
          tax_rate: taxRate,
          tax_due: stateTax
        });

        netTaxDue += stateTax;
      }

      // Add states where fuel was purchased but no miles were logged (rare, but possible)
      for (const [state, gal] of Object.entries(fuelByState)) {
        if (!milesByState[state] && state !== 'UNKNOWN') {
           const taxRate = taxRates[state] || 0;
           const stateTax = -gal * taxRate; // Full credit
           breakdown.push({
             state,
             miles: 0,
             gallons_purchased: gal,
             taxable_gallons: 0,
             tax_rate: taxRate,
             tax_due: stateTax
           });
           netTaxDue += stateTax;
        }
      }

      breakdown.sort((a, b) => b.miles - a.miles);

      setParsedData({
        total_miles: totalMiles,
        total_gallons: totalGallons,
        overall_mpg: mpg,
        state_breakdown: breakdown,
        net_tax_due: netTaxDue
      });
      setActiveReportId(null);

    } catch (err: any) {
      alert("Calculation Error: " + err.message);
    }
    setCalculating(false);
  }

  function requirePin(action: Function) {
    setPinAction(() => action);
    setShowPinModal(true);
  }

  async function handleSaveReport() {
    if (!parsedData) return;

    requirePin(async () => {
      const { error } = await supabase.from('ifta_reports').insert([{
        quarter,
        year: parseInt(year),
        total_miles: parsedData.total_miles,
        total_gallons: parsedData.total_gallons,
        overall_mpg: parsedData.overall_mpg,
        state_breakdown: parsedData.state_breakdown,
        net_tax_due: parsedData.net_tax_due
      }]);

      if (!error) {
        alert("IFTA Report saved successfully!");
        setParsedData(null);
        setCsvFile(null);
        fetchReports();
      } else {
        alert("Failed to save report: " + error.message);
      }
    });
  }

  function handleDeleteReport(id: string) {
    requirePin(async () => {
      const { error } = await supabase.from('ifta_reports').delete().eq('id', id);
      if (!error) {
        fetchReports();
      } else {
        alert("Failed to delete report: " + error.message);
      }
    });
  }

  function handleSaveRates() {
    requirePin(() => {
      setTaxRates(tempRates);
      setShowRatesModal(false);
    });
  }

  function loadReport(r: any) {
    if (activeReportId === r.id) {
      setParsedData(null);
      setActiveReportId(null);
    } else {
      setQuarter(r.quarter);
      setYear(r.year.toString());
      setParsedData({
        total_miles: r.total_miles,
        total_gallons: r.total_gallons,
        overall_mpg: r.overall_mpg,
        state_breakdown: r.state_breakdown,
        net_tax_due: r.net_tax_due
      });
      setActiveReportId(r.id);
      // Scroll to top to see preview
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className="text-white pb-20 print:text-black print:pb-0">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center">
            <span className="bg-primary/20 text-primary p-2 rounded-xl mr-3">
              <FileBarChart className="w-6 h-6" />
            </span>
            IFTA Tax Reports
          </h1>
          <p className="text-gray-400">Automated International Fuel Tax Agreement calculations.</p>
        </div>
        <button 
          onClick={() => { setTempRates({...taxRates}); setShowRatesModal(true); }}
          className="flex items-center px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-sm"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit Tax Rates
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
        
        {/* Left Col: Upload & Calculation */}
        <div className="lg:col-span-1 space-y-6 print:hidden">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center">
              <Calculator className="w-5 h-5 text-primary mr-2" />
              Generate New Report
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Quarter</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white" value={quarter} onChange={e => setQuarter(e.target.value)}>
                  <option className="bg-gray-900 text-white" value="Q1">Q1 (Jan-Mar)</option>
                  <option className="bg-gray-900 text-white" value="Q2">Q2 (Apr-Jun)</option>
                  <option className="bg-gray-900 text-white" value="Q3">Q3 (Jul-Sep)</option>
                  <option className="bg-gray-900 text-white" value="Q4">Q4 (Oct-Dec)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Year</label>
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white" value={year} onChange={e => setYear(e.target.value)} />
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs text-gray-400 block mb-1">Upload Motive Distance Report (CSV)</label>
              <div className="border-2 border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-white/5 hover:bg-white/10 transition cursor-pointer relative">
                <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Upload className="w-8 h-8 text-gray-500 mb-2" />
                <p className="text-sm font-medium text-gray-300">{csvFile ? csvFile.name : 'Drag & Drop or Click to Select'}</p>
                <p className="text-xs text-gray-500 mt-1">Must contain 'State/Jurisdiction' and 'Distance' columns</p>
              </div>
            </div>

            <button 
              onClick={handleCalculate}
              disabled={calculating || !csvFile}
              className={`w-full py-3 rounded-xl font-bold flex justify-center items-center transition ${calculating || !csvFile ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-primary hover:bg-blue-500 text-white'}`}
            >
              {calculating ? 'Calculating...' : 'Run IFTA Calculation'}
            </button>
          </div>

          {/* Guidelines */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5">
            <h3 className="text-yellow-500 font-bold flex items-center mb-2 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" /> How it works
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              This tool computes the overall fleet MPG by crossing the uploaded distance with the fuel logs saved in your system for the selected quarter. 
              <br/><br/>
              <strong>Formula used:</strong> Taxable Gallons = Miles in State / Overall MPG. Then subtracts gallons purchased in that state to find Net Taxable Gallons.
            </p>
          </div>
        </div>

        {/* Right Col: Results & History */}
        <div className="lg:col-span-2 space-y-8 print:w-full">
          
          {/* Active Calculation Result */}
          {parsedData && (
            <div className="glass-panel p-6 border-2 border-primary/30 print:border-none print:shadow-none print:bg-white print:p-10">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 print:border-black/20 print:mb-4 print:pb-2">
                <h2 className="text-xl font-bold text-white print:text-black print:text-lg flex items-center">
                  Northstar Fleet - {quarter} {year} IFTA Report
                </h2>
                <div className="flex gap-2 print:hidden">
                  <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center transition">
                    <Download className="w-4 h-4 mr-2" /> Print / PDF
                  </button>
                  <button onClick={handleSaveReport} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center transition shadow-lg shadow-green-500/20">
                    <Save className="w-4 h-4 mr-2" /> Save Report to History
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-8 print:mb-4 print:gap-2">
                <div className="bg-white/5 print:bg-gray-100 rounded-xl p-4 print:p-2 text-center">
                  <p className="text-xs text-gray-400 print:text-gray-600 print:text-[10px] uppercase tracking-widest mb-1">Total Miles</p>
                  <p className="text-2xl font-black text-white print:text-black print:text-lg">{parsedData.total_miles.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 print:bg-gray-100 rounded-xl p-4 print:p-2 text-center">
                  <p className="text-xs text-gray-400 print:text-gray-600 print:text-[10px] uppercase tracking-widest mb-1">Total Fuel (Gal)</p>
                  <p className="text-2xl font-black text-white print:text-black print:text-lg">{parsedData.total_gallons.toLocaleString(undefined, {maximumFractionDigits:1})}</p>
                </div>
                <div className="bg-white/5 print:bg-gray-100 rounded-xl p-4 print:p-2 text-center">
                  <p className="text-xs text-gray-400 print:text-gray-600 print:text-[10px] uppercase tracking-widest mb-1">Fleet MPG</p>
                  <p className="text-2xl font-black text-blue-400 print:text-blue-700 print:text-lg">{parsedData.overall_mpg.toFixed(2)}</p>
                </div>
                <div className={`rounded-xl p-4 print:p-2 text-center border-2 ${parsedData.net_tax_due > 0 ? 'bg-red-500/10 border-red-500/30 print:bg-red-50 print:border-red-300' : 'bg-green-500/10 border-green-500/30 print:bg-green-50 print:border-green-300'}`}>
                  <p className={`text-xs uppercase tracking-widest mb-1 font-bold print:text-[10px] ${parsedData.net_tax_due > 0 ? 'text-red-400 print:text-red-700' : 'text-green-400 print:text-green-700'}`}>Net Tax Due</p>
                  <p className={`text-2xl font-black print:text-lg ${parsedData.net_tax_due > 0 ? 'text-red-500 print:text-red-700' : 'text-green-500 print:text-green-700'}`}>
                    ${Math.abs(parsedData.net_tax_due).toFixed(2)} {parsedData.net_tax_due <= 0 && '(Credit)'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto print:overflow-visible print:mx-4">
                <table className="w-full text-left border-collapse print:border print:border-gray-300">
                  <thead>
                    <tr className="border-b border-white/10 print:border-gray-300 print:bg-gray-100 text-gray-400 print:text-gray-700 text-xs print:text-[10px] uppercase tracking-wider">
                      <th className="p-3 print:p-1.5">State</th>
                      <th className="p-3 print:p-1.5 text-right">Miles</th>
                      <th className="p-3 print:p-1.5 text-right">Taxable Gal</th>
                      <th className="p-3 print:p-1.5 text-right">Tax Paid Gal</th>
                      <th className="p-3 print:p-1.5 text-right">Net Gal</th>
                      <th className="p-3 print:p-1.5 text-right">Rate</th>
                      <th className="p-3 print:p-1.5 text-right">Tax Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 print:divide-gray-200 text-sm print:text-xs">
                    {parsedData.state_breakdown.map((st: any) => {
                      const netGal = st.taxable_gallons - st.gallons_purchased;
                      return (
                        <tr key={st.state} className="hover:bg-white/5 transition print:hover:bg-transparent">
                          <td className="p-3 print:p-1.5 font-bold text-white print:text-black print:border-r print:border-gray-200">{st.state}</td>
                          <td className="p-3 print:p-1.5 text-right text-gray-300 print:text-gray-800 print:border-r print:border-gray-200">{st.miles.toLocaleString(undefined, {maximumFractionDigits:1})}</td>
                          <td className="p-3 print:p-1.5 text-right text-gray-300 print:text-gray-800 print:border-r print:border-gray-200">{st.taxable_gallons.toFixed(1)}</td>
                          <td className="p-3 print:p-1.5 text-right text-green-400 print:text-green-700 print:border-r print:border-gray-200">{st.gallons_purchased.toFixed(1)}</td>
                          <td className={`p-3 print:p-1.5 text-right font-bold print:border-r print:border-gray-200 ${netGal > 0 ? 'text-red-400 print:text-red-700' : 'text-green-400 print:text-green-700'}`}>{netGal > 0 ? '+' : ''}{netGal.toFixed(1)}</td>
                          <td className="p-3 print:p-1.5 text-right text-gray-400 print:text-gray-700 print:border-r print:border-gray-200">${st.tax_rate.toFixed(3)}</td>
                          <td className={`p-3 print:p-1.5 text-right font-bold ${st.tax_due > 0 ? 'text-red-400 print:text-red-700' : 'text-green-400 print:text-green-700'}`}>${st.tax_due.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* History */}
          <div className="glass-panel p-6 print:hidden">
            <h2 className="text-lg font-bold mb-4">Saved Reports History</h2>
            {loading ? (
               <div className="animate-pulse flex space-x-4"><div className="h-4 bg-white/10 rounded w-3/4"></div></div>
            ) : reports.length === 0 ? (
               <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-white/5">
                 <FileBarChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                 <p>No saved reports yet.</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {reports.map((r: any) => (
                   <div key={r.id} onClick={() => loadReport(r)} className={`border rounded-xl p-5 relative group cursor-pointer transition ${activeReportId === r.id ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                     <button onClick={(e) => { e.stopPropagation(); handleDeleteReport(r.id); }} className="absolute top-4 right-4 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition z-10">
                       <Trash2 className="w-5 h-5" />
                     </button>
                     <div className="flex items-center mb-3">
                       <div className="w-10 h-10 bg-primary/20 text-primary rounded-lg flex items-center justify-center font-black mr-3">
                         {r.quarter}
                       </div>
                       <div>
                         <h3 className="font-bold text-white text-lg">{r.year} IFTA Return</h3>
                         <p className="text-xs text-gray-400">MPG: {Number(r.overall_mpg).toFixed(2)}</p>
                       </div>
                     </div>
                     <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                       <div className="text-xs text-gray-400">Net Due:</div>
                       <div className={`font-black text-lg ${r.net_tax_due > 0 ? 'text-red-400' : 'text-green-400'}`}>
                         ${Math.abs(r.net_tax_due).toFixed(2)} {r.net_tax_due <= 0 && '(Credit)'}
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>

        </div>
      </div>

      {/* Tax Rates Edit Modal */}
      {showRatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Edit IFTA Tax Rates</h2>
              <button onClick={() => setShowRatesModal(false)} className="text-gray-400 hover:text-white transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(tempRates).map(([state, rate]) => (
                <div key={state}>
                  <label className="text-xs text-gray-400 block mb-1">{state}</label>
                  <input 
                    type="number" step="0.001"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white focus:border-primary focus:outline-none"
                    value={rate}
                    onChange={e => setTempRates({...tempRates, [state]: parseFloat(e.target.value) || 0})}
                  />
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end">
              <button onClick={handleSaveRates} className="bg-primary hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pin Modal */}
      <PinModal
        isOpen={showPinModal}
        actionText="Confirm Action"
        onClose={() => {
          setShowPinModal(false);
          setPinAction(null);
        }}
        onSuccess={() => {
          if (pinAction) pinAction();
          setShowPinModal(false);
          setPinAction(null);
        }}
      />
    </div>
  );
}
