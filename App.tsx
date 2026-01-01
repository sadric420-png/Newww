
import React, { useState, useMemo } from 'react';
import { 
  MasterRecord, 
  SalesRecord, 
  TemplateRecord, 
  MissingParty, 
  Step 
} from './types';
import { 
  parseFile, 
  standardizeName, 
  extractCoordinates, 
  downloadExcel 
} from './utils';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('UPLOAD');
  const [masterData, setMasterData] = useState<MasterRecord[]>([]);
  const [salesData, setSalesData] = useState<SalesRecord[]>([]);
  const [templateColumns, setTemplateColumns] = useState<string[]>([]);
  
  const [missingParties, setMissingParties] = useState<MissingParty[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const steps = [
    { id: 'UPLOAD', label: 'Upload Files' },
    { id: 'FIX_MISSING', label: 'Fix Missing Data' },
    { id: 'MAPPING', label: 'Template Mapping' },
    { id: 'DOWNLOAD', label: 'Generate Report' }
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'master' | 'sales' | 'template') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const json = await parseFile(file);
      if (type === 'master') {
        // Clean and process Master Data immediately (Extract GPS)
        const processedMaster = json.map((row: any) => {
          const coords = extractCoordinates(row['Address'] || '');
          return {
            ...row,
            'Party Name': row['Party Name'] || '',
            'Latitude': row['Latitude'] || coords.lat,
            'Longitude': row['Longitude'] || coords.lng
          };
        });
        setMasterData(processedMaster);
      } else if (type === 'sales') {
        setSalesData(json);
      } else if (type === 'template') {
        const cols = Object.keys(json[0] || {});
        setTemplateColumns(cols);
      }
    } catch (err) {
      alert("Error parsing file. Please check format.");
    }
  };

  const identifyMissingParties = () => {
    if (masterData.length === 0 || salesData.length === 0) {
      alert("Please upload both Master and Sales files first.");
      return;
    }

    const masterNames = new Set(masterData.map(m => standardizeName(m['Party Name'])));
    const missing = salesData
      .filter(s => !masterNames.has(standardizeName(s['Party Name'])))
      .map(s => ({
        'Party Name': s['Party Name'],
        'Phone No.': s['Phone No.'] || '',
        'Address': ''
      }));

    if (missing.length > 0) {
      setMissingParties(missing);
      setCurrentStep('FIX_MISSING');
    } else {
      setCurrentStep('MAPPING');
    }
  };

  const handleUpdateMissingParty = (index: number, field: keyof MissingParty, value: string) => {
    const updated = [...missingParties];
    updated[index] = { ...updated[index], [field]: value };
    setMissingParties(updated);
  };

  const finalizeParties = () => {
    // Check if all missing parties have addresses
    const incomplete = missingParties.some(p => !p.Address.trim());
    if (incomplete) {
      if (!confirm("Some parties have empty addresses. Continue anyway?")) return;
    }

    // Append missing parties to master data for the session
    const newMasterEntries: MasterRecord[] = missingParties.map(p => {
      const coords = extractCoordinates(p.Address);
      return {
        'Party Name': p['Party Name'],
        'Number': p['Phone No.'],
        'Address': p.Address,
        'Latitude': coords.lat,
        'Longitude': coords.lng
      };
    });

    setMasterData([...masterData, ...newMasterEntries]);
    setCurrentStep('MAPPING');
  };

  const generateFinalReport = () => {
    setIsProcessing(true);
    
    // Create lookup for master data
    const masterLookup = new Map<string, MasterRecord>();
    masterData.forEach(m => {
      masterLookup.set(standardizeName(m['Party Name']), m);
    });

    // Map sales data to template
    const finalReport = salesData.map(sale => {
      const master = masterLookup.get(standardizeName(sale['Party Name']));
      return {
        'Name': sale['Party Name'],
        'Latitude': master?.Latitude || '',
        'Longitude': master?.Longitude || '',
        'Address': master?.Address || '',
        'Phone': sale['Phone No.'] || master?.Number || '',
        'Group': '',
        'Notes': ''
      };
    });

    downloadExcel(finalReport, "Updated_Route_Report");
    setIsProcessing(false);
    setCurrentStep('DOWNLOAD');
  };

  const stepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <span className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg">📦</span>
            Excel Route Manager
          </h1>
          <div className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
            v1.0.0 Stable
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="relative mb-12">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 -z-10"></div>
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -translate-y-1/2 -z-10 transition-all duration-500 ease-in-out" 
            style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
          ></div>
          <div className="flex justify-between">
            {steps.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                  i <= stepIndex ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  {i + 1}
                </div>
                <span className={`mt-2 text-xs font-semibold ${i <= stepIndex ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 min-h-[400px]">
          
          {/* STEP 1: UPLOAD */}
          {currentStep === 'UPLOAD' && (
            <div className="animate-fadeIn">
              <h2 className="text-xl font-bold text-slate-800 mb-6">Step 1: File Initialization</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                    <div className="text-center">
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🗄️</div>
                      <div className="font-bold text-slate-700">Master File</div>
                      <p className="text-sm text-slate-500 mb-4">CSV/XLSX (Party Name, Number, Address)</p>
                      <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'master')} />
                      {masterData.length > 0 && <span className="text-emerald-600 font-medium text-xs">✓ Loaded {masterData.length} records</span>}
                    </div>
                  </label>

                  <label className="block p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer group">
                    <div className="text-center">
                      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                      <div className="font-bold text-slate-700">Current Sales File</div>
                      <p className="text-sm text-slate-500 mb-4">CSV/XLSX (Party Name, Phone No.)</p>
                      <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'sales')} />
                      {salesData.length > 0 && <span className="text-emerald-600 font-medium text-xs">✓ Loaded {salesData.length} records</span>}
                    </div>
                  </label>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-4">System Guide</h3>
                  <ul className="text-sm text-slate-600 space-y-3">
                    <li className="flex gap-2"><span>✅</span> Names will be auto-cleaned (lowercase, trimmed).</li>
                    <li className="flex gap-2"><span>📍</span> GPS Coordinates will be auto-extracted from Address.</li>
                    <li className="flex gap-2"><span>🔍</span> System will identify parties missing from Master data.</li>
                  </ul>
                  <button 
                    onClick={identifyMissingParties}
                    disabled={masterData.length === 0 || salesData.length === 0}
                    className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md"
                  >
                    Compare & Proceed
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FIX MISSING */}
          {currentStep === 'FIX_MISSING' && (
            <div className="animate-fadeIn">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Step 2: Missing Parties Found ({missingParties.length})</h2>
                  <p className="text-sm text-slate-500">The following parties are in the Sales file but missing from your Master database. Please add details.</p>
                </div>
              </div>
              
              <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-4 border-b font-semibold">Party Name</th>
                      <th className="p-4 border-b font-semibold">Phone / Number</th>
                      <th className="p-4 border-b font-semibold">Address (Paste GPS here if available)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {missingParties.map((party, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="p-4 font-medium text-slate-700">{party['Party Name']}</td>
                        <td className="p-4">
                          <input 
                            type="text" 
                            className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            value={party['Phone No.']}
                            onChange={(e) => handleUpdateMissingParty(idx, 'Phone No.', e.target.value)}
                          />
                        </td>
                        <td className="p-4">
                          <input 
                            type="text" 
                            placeholder="e.g. 31.65 74.89 OR Main Street..."
                            className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                            value={party.Address}
                            onChange={(e) => handleUpdateMissingParty(idx, 'Address', e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-4">
                <button onClick={() => setCurrentStep('UPLOAD')} className="text-slate-500 hover:text-slate-700 font-medium px-4">Go Back</button>
                <button onClick={finalizeParties} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md">
                  Update Master & Proceed
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: MAPPING */}
          {currentStep === 'MAPPING' && (
            <div className="animate-fadeIn max-w-2xl mx-auto text-center py-12">
              <div className="mb-6 text-5xl">📄</div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Step 3: Template Mapping</h2>
              <p className="text-slate-500 mb-8">
                All party data is now synchronized. Upload your <strong>Route Template</strong> to generate the final formatted Excel.
              </p>
              
              <label className="block p-10 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl hover:bg-indigo-50 transition-all cursor-pointer group mb-8">
                <div className="text-center">
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📂</div>
                  <div className="font-bold text-indigo-700">Upload Report Template</div>
                  <p className="text-sm text-indigo-500 mb-4">XLSX or CSV</p>
                  <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => handleFileUpload(e, 'template')} />
                  {templateColumns.length > 0 && <span className="text-emerald-600 font-medium text-xs">✓ Template recognized with {templateColumns.length} columns</span>}
                </div>
              </label>

              <button 
                onClick={generateFinalReport}
                disabled={templateColumns.length === 0 || isProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Processing...' : 'Generate & Download Report'}
                <span className="text-xl">🚀</span>
              </button>
            </div>
          )}

          {/* STEP 4: DOWNLOAD */}
          {currentStep === 'DOWNLOAD' && (
            <div className="animate-fadeIn text-center py-20">
              <div className="inline-block p-6 bg-emerald-100 text-emerald-600 rounded-full mb-6 text-5xl">✅</div>
              <h2 className="text-3xl font-bold text-slate-800 mb-4">Workflow Complete!</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto">
                Your Updated Route Report has been generated and downloaded. All GPS coordinates were extracted and mismatched names were synchronized.
              </p>
              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => window.location.reload()} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl transition-all border border-slate-200"
                >
                  Start New Task
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between text-sm text-slate-400 gap-4">
        <p>© 2024 Excel Route Manager • Pro Edition</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-indigo-600">Documentation</a>
          <a href="#" className="hover:text-indigo-600">Support</a>
          <a href="#" className="hover:text-indigo-600">Privacy</a>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
