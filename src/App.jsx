import React, { useState, useEffect } from 'react';
import logo from './assets/image.png';
import { saveHistoryOnline, updateHistoryOnline, fetchHistoryOnline, deleteHistoryOnline, isFirebaseConfigured } from './firebase';

// Utility to convert number to words
const numberToWords = (num) => {
  if (num === 0) return 'Zero Only';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  const convertSection = (n) => {
    let str = '';
    if (n >= 100) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += units[n] + ' ';
    }
    return str;
  };

  const [wholePart, decimalPart] = num.toFixed(2).split('.');
  let n = parseInt(wholePart);
  let result = '';
  let scaleIndex = 0;

  if (n === 0) result = 'Zero ';
  else {
    while (n > 0) {
      let section = n % 1000;
      if (section > 0) {
        result = convertSection(section) + scales[scaleIndex] + ' ' + result;
      }
      n = Math.floor(n / 1000);
      scaleIndex++;
    }
  }

  result = result.trim() + ' Only';
  if (parseInt(decimalPart) > 0) {
    result += ` and ${decimalPart}/100`;
  }
  return result;
};

function App() {
  const [invoiceData, setInvoiceData] = useState({
    fsNo: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    buyerName: '',
    buyerTradeName: '',
    buyerTin: '',
    buyerVat: '',
    paymentMode: 'Cash',
    chequeNo: '',
    preparedBy: '',
    signatureLabel: 'Prepared by',
    address: {
      zone: '',
      Woreda: '',
      houseNo: ''
    }
  });

  const [items, setItems] = useState([
    { id: 1, description: '', unit: 'Pcs', qty: 1, unitPrice: 0 }
  ]);

  const [history, setHistory] = useState([]);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'history'
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load history from localStorage and Cloud on mount
  useEffect(() => {
    // 1. Load from LocalStorage first (instant, no loading state needed)
    const savedHistory = localStorage.getItem('invoice_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load local history', e);
      }
    }

    // 2. Load from Cloud if configured (silent background sync)
    const syncWithCloud = async () => {
      if (isFirebaseConfigured) {
        try {
          const cloudHistory = await fetchHistoryOnline();
          if (cloudHistory && cloudHistory.length > 0) {
            setHistory(cloudHistory);
            localStorage.setItem('invoice_history', JSON.stringify(cloudHistory));
          }
        } catch (error) {
          console.error("Cloud sync failed silently in background:", error);
        }
      }
    };

    syncWithCloud();
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('invoice_history', JSON.stringify(history));
  }, [history]);

  const handleInputChange = (e) => {
    if (isReadOnly) return;
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setInvoiceData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setInvoiceData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleItemChange = (id, field, value) => {
    if (isReadOnly) return;
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    if (isReadOnly) return;
    setItems(prev => [...prev, { id: Date.now(), description: '', unit: 'Pcs', qty: 1, unitPrice: 0 }]);
  };

  const removeItem = (id) => {
    if (isReadOnly) return;
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
  };

  const subtotal = calculateSubtotal();
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const handlePrint = () => {
    // 1. Trigger print immediately (synchronously) to avoid popup blockers
    // and to capture the DOM before any "Synchronizing" overlay appears
    window.print();

    // 2. Handle saving to history in the background
    if (!isReadOnly) {
      saveRecordToHistory();
    }
  };

  const saveRecordToHistory = async () => {
    setIsSyncing(true);
    
    const invoiceToSave = {
      invoiceData: { ...invoiceData },
      items: [...items],
      total: total,
      timestamp: editingId ? `${new Date().toLocaleString()} (Edited)` : new Date().toLocaleString()
    };

    if (editingId) {
      // Update existing record locally first
      setHistory(prev => prev.map(item => 
        item.id === editingId ? { ...item, ...invoiceToSave } : item
      ));
      
      if (isFirebaseConfigured) {
        await updateHistoryOnline(editingId, invoiceToSave);
      }
    } else {
      // Create new record locally first with a temporary ID
      const tempId = Date.now();
      const historyItem = { id: tempId, ...invoiceToSave };
      setHistory(prev => [historyItem, ...prev]);

      // Sync to cloud in background
      if (isFirebaseConfigured) {
        const newId = await saveHistoryOnline(invoiceToSave);
        if (newId) {
          // Update the local record with the real Firebase ID
          setHistory(prev => prev.map(item => 
            item.id === tempId ? { ...item, id: newId } : item
          ));
        }
      }
    }
    
    setIsSyncing(false);
  };

  const loadHistoryItem = (item) => {
    setInvoiceData(item.invoiceData);
    setItems(item.items);
    setIsReadOnly(true);
    setEditingId(item.id);
    setViewMode('edit'); // Switch back to form view to see the details
  };

  const enableEditing = () => {
    if (confirm('Are you sure you want to edit this saved record? Changes will overwrite the previous data.')) {
      setIsReadOnly(false);
    }
  };

  const createNewInvoice = () => {
    setInvoiceData({
      fsNo: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      buyerName: '',
      buyerTradeName: '',
      buyerTin: '',
      buyerVat: '',
      paymentMode: 'Cash',
      chequeNo: '',
      preparedBy: '',
      signatureLabel: 'Prepared by',
      address: {
        zone: '',
        Woreda: '',
        houseNo: ''
      }
    });
    setItems([{ id: Date.now(), description: '', unit: 'Pcs', qty: 1, unitPrice: 0 }]);
    setIsReadOnly(false);
    setEditingId(null);
    setViewMode('edit');
  };

  const deleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this history record permanently?')) {
      setIsSyncing(true);
      setHistory(prev => prev.filter(item => item.id !== id));
      
      if (isFirebaseConfigured) {
        await deleteHistoryOnline(id);
      }
      
      if (editingId === id) {
        createNewInvoice();
      }
      setIsSyncing(false);
    }
  };

  return (
    <div className="app-container">
      <style>{`
        .form-input {
          width: 100%;
          padding: 0.875rem 1.25rem;
          border: 2px solid #e2e8f0;
          border-radius: 1rem;
          font-size: 1rem;
          font-weight: 500;
          color: #1e293b;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: #ffffff;
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
        }

        .form-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15), inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
          background: #fff;
          transform: translateY(-1px);
        }

        .form-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }

        .form-input:disabled {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #64748b;
          cursor: not-allowed;
          box-shadow: none;
        }

        .tabs-header {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          background: #f1f5f9;
          padding: 0.4rem;
          border-radius: 1rem;
        }

        .tab-btn {
          flex: 1;
          padding: 0.75rem;
          border-radius: 0.75rem;
          border: none;
          background: transparent;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn.active {
          background: white;
          color: #6366f1;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .history-card {
          background: white;
          border: 2px solid #e2e8f0;
          padding: 1rem;
          border-radius: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .history-card:hover {
          border-color: #6366f1;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .history-card-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 0.5rem;
        }

        .history-card-title {
          font-weight: 800;
          color: #1e293b;
        }

        .history-card-date {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .history-card-body {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
        }

        .history-card-buyer {
          color: #475569;
          font-weight: 500;
        }

        .history-card-amount {
          color: #6366f1;
          font-weight: 800;
        }

        .btn-delete-history {
          background: #fee2e2;
          color: #ef4444;
          border: none;
          border-radius: 0.5rem;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          cursor: pointer;
          margin-left: 1rem;
        }

        .readonly-badge {
          background: #fef3c7;
          color: #d97706;
          padding: 0.25rem 0.75rem;
          border-radius: 2rem;
          font-size: 0.75rem;
          font-weight: 700;
          margin-bottom: 1rem;
          display: inline-block;
          border: 1px solid #fbbf24;
        }
      `}</style>
      
      {/* Editor Section */}
      <aside className="editor-section">
        <div className="tabs-header">
          <button 
            className={`tab-btn ${viewMode === 'edit' ? 'active' : ''}`}
            onClick={() => setViewMode('edit')}
          >
            {isReadOnly ? '📋 Viewing Detail' : '✍️ Create New'}
          </button>
          <button 
            className={`tab-btn ${viewMode === 'history' ? 'active' : ''}`}
            onClick={() => setViewMode('history')}
          >
            🕒 Recent History
          </button>
        </div>

        {viewMode === 'edit' ? (
          <>
            {isReadOnly && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="readonly-badge">View Only Mode (History Record)</span>
                  <button onClick={createNewInvoice} className="btn" style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', background: '#e0e7ff', color: '#4338ca' }}>
                    Create New Instead
                  </button>
                </div>
                <button 
                  onClick={enableEditing} 
                  className="btn" 
                  style={{ width: '100%', background: '#fffbeb', border: '2px solid #fbbf24', color: '#92400e', fontSize: '0.9rem', padding: '0.6rem' }}
                >
                  🔓 Unlock & Edit This Record
                </button>
              </div>
            )}
            
            <h1 className="editor-title">
              <span>{isReadOnly ? '📄' : (editingId ? '✏️' : '📝')}</span> 
              {isReadOnly ? ' Sales Attachment' : (editingId ? ' Edit Saved Record' : ' Sales Attachment')}
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>FS No.</label>
                <input type="text" name="fsNo" value={invoiceData.fsNo} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
                <span className="help-text">Fiscal Serial Number from your cash register</span>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="date" value={invoiceData.date} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
                <span className="help-text">Transaction date</span>
              </div>
            </div>
            

            <div className="form-group">
              <label>Buyer's Name</label>
              <input type="text" name="buyerName" value={invoiceData.buyerName} onChange={handleInputChange} disabled={isReadOnly} className="form-input" placeholder="Enter buyer name" />
              <span className="help-text">Official name of the customer</span>
            </div>

            <div className="form-group">
              <label>Buyer's Trade Name</label>
              <input type="text" name="buyerTradeName" value={invoiceData.buyerTradeName} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
              <span className="help-text">Business or Trading name</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Buyer's TIN</label>
                <input type="text" name="buyerTin" value={invoiceData.buyerTin} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
                <span className="help-text">10-digit Tax Identification Number</span>
              </div>
              <div className="form-group">
                <label>Buyer's VAT</label>
                <input type="text" name="buyerVat" value={invoiceData.buyerVat} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
                <span className="help-text">VAT Registration Number</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Zone/Ketema</label>
                <input type="text" name="address.zone" value={invoiceData.address.zone} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
              </div>
              <div className="form-group">
                <label>Woreda</label>
                <input type="text" name="address.Woreda" value={invoiceData.address.Woreda} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
              </div>
              <div className="form-group">
                <label>House No.</label>
                <input type="text" name="address.houseNo" value={invoiceData.address.houseNo} onChange={handleInputChange} disabled={isReadOnly} className="form-input" />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Payment Method</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label className="checkbox-custom">
                  <input type="radio" name="paymentMode" value="Cash" checked={invoiceData.paymentMode === 'Cash'} onChange={handleInputChange} disabled={isReadOnly} />
                  Cash
                </label>
                <label className="checkbox-custom">
                  <input type="radio" name="paymentMode" value="Cheque" checked={invoiceData.paymentMode === 'Cheque'} onChange={handleInputChange} disabled={isReadOnly} />
                  Cheque
                </label>
              </div>
              {invoiceData.paymentMode === 'Cheque' && (
                <input type="text" name="chequeNo" value={invoiceData.chequeNo} onChange={handleInputChange} disabled={isReadOnly} className="form-input" style={{ marginTop: '0.5rem' }} placeholder="Enter Cheque Number" />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Signature Label</label>
                <input type="text" name="signatureLabel" value={invoiceData.signatureLabel} onChange={handleInputChange} disabled={isReadOnly} className="form-input" placeholder="e.g. Prepared by" />
              </div>
              <div className="form-group">
                <label>Prepared By (Name)</label>
                <input type="text" name="preparedBy" value={invoiceData.preparedBy} onChange={handleInputChange} disabled={isReadOnly} className="form-input" placeholder="Name" />
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: '#1e293b', borderLeft: '4px solid #6366f1', paddingLeft: '0.75rem' }}>
                🛒 Product & Pricing Details
              </h3>

              <table className="items-table-editor">
                <thead>
                  <tr style={{ display: 'flex', gap: '0.5rem', padding: '0 0.25rem', marginBottom: '0.5rem' }}>
                    <th style={{ flex: 2, textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Item Description</th>
                    <th style={{ width: '90px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6366f1' }}>Unit Type</th>
                    <th style={{ width: '90px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6366f1' }}>Quantity</th>
                    <th style={{ width: '130px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: '#6366f1' }}>Unit Price</th>
                    {!isReadOnly && <th style={{ width: '50px' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="item-row-editor" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <td style={{ flex: 2 }}>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          disabled={isReadOnly}
                          className="form-input"
                          placeholder="Product description..."
                        />
                      </td>
                      <td style={{ width: '90px' }}>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                          disabled={isReadOnly}
                          className="form-input"
                          placeholder="Pcs/Kg"
                        />
                      </td>
                      <td style={{ width: '90px' }}>
                        <input
                          type="number"
                          value={item.qty === 0 ? '' : item.qty}
                          onChange={(e) => handleItemChange(item.id, 'qty', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          disabled={isReadOnly}
                          className="form-input"
                          placeholder="0"
                        />
                      </td>
                      <td style={{ width: '130px' }}>
                        <input
                          type="number"
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          disabled={isReadOnly}
                          className="form-input"
                          placeholder="0.00"
                        />
                      </td>
                      {!isReadOnly && (
                        <td style={{ width: '50px' }}>
                          <button onClick={() => removeItem(item.id)} className="btn btn-remove" style={{ width: '100%', height: '45px' }}>✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isReadOnly && (
              <>
                <button onClick={addItem} className="btn btn-add">+ Add Item</button>
                <button
                  onClick={() => { if (confirm('Clear all data?')) { setItems([{ id: Date.now(), description: '', unit: 'Pcs', qty: 1, unitPrice: 0 }]); setInvoiceData(prev => ({ ...prev, buyerName: '', buyerTradeName: '', buyerTin: '', buyerVat: '', address: { zone: '', kebele: '', houseNo: '' } })); } }}
                  className="btn btn-reset"
                >
                  Reset Form
                </button>
              </>
            )}

            <div className="btn-print-container" style={{ marginTop: '2rem' }}>
              <button onClick={handlePrint} className="btn btn-primary" style={{ width: '100%' }}>
                {isReadOnly ? '🖨️ Print Record Again' : (editingId ? '💾 Update & Print Saved Record' : '📤 Export & Save to History')}
              </button>
            </div>
          </>
        ) : (
          <div className="history-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 className="editor-title">
                  <span>🕒</span> Recent History
                </h1>
                <p style={{ marginBottom: '1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                  All invoices are stored permanently on this device until deleted.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.4rem 0.8rem', 
                  borderRadius: '2rem', 
                  fontSize: '0.75rem', 
                  fontWeight: '700',
                  background: isFirebaseConfigured ? '#ecfdf5' : '#fef2f2',
                  color: isFirebaseConfigured ? '#059669' : '#dc2626',
                  border: `1px solid ${isFirebaseConfigured ? '#10b981' : '#f87171'}`
                }}>
                  {isFirebaseConfigured ? '☁️ Cloud Synced' : '🔌 Local Only'}
                </div>
                {!isFirebaseConfigured && (
                  <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                    Connect Firebase to store online
                  </p>
                )}
              </div>
            </div>

            {isSyncing && (
              <div style={{ 
                background: 'rgba(255,255,255,0.8)', 
                padding: '1rem', 
                borderRadius: '1rem', 
                textAlign: 'center', 
                marginBottom: '1rem',
                border: '1px solid #e2e8f0',
                color: '#6366f1',
                fontWeight: '700'
              }}>
                🔄 Synchronizing...
              </div>
            )}
            
            <div className="history-list">
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '1.5rem', border: '2px dashed #e2e8f0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                  <p style={{ fontWeight: '600', color: '#94a3b8' }}>No history records found yet.</p>
                  <button onClick={createNewInvoice} className="btn btn-primary" style={{ marginTop: '1rem' }}>Create First Invoice</button>
                </div>
              ) : (
                history.map(item => (
                  <div key={item.id} className="history-card" onClick={() => loadHistoryItem(item)}>
                    <div className="history-card-header">
                      <span className="history-card-title">FS No: {item.invoiceData.fsNo || 'N/A'}</span>
                      <span className="history-card-date">{item.timestamp}</span>
                    </div>
                    <div className="history-card-body">
                      <div>
                        <div className="history-card-buyer">{item.invoiceData.buyerName || 'Unknown Buyer'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.items.length} items</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="history-card-amount">{item.total.toLocaleString()} ETB</span>
                        <button className="btn-delete-history" onClick={(e) => deleteHistoryItem(item.id, e)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Preview Section */}
      <main className="preview-section">
        <div className="invoice-a4">
          <div className="invoice-header">
            <div className="logo-container">
              <img src={logo} alt="Kudeja Logo" style={{ height: '110px', objectFit: 'contain' }} />
            </div>
            <div className="company-info">
              <div className="company-name" style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>ኩደጃ ትሬዲንግ ኃ/የተ/የግ/ማህበር</div>
              <div className="company-name" style={{ fontSize: '1.4rem' }}>KUDEJA TRADING PLC</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#000' }}>
                A.A, Subcity Kirkos woreda, 09,<br />
                Dembel building H.No 1146 Shop No SFS/037
              </div>
              <p style={{ marginTop: '0.25rem' }}>Supplier's TIN: 0052154477</p>
              <p>Supplier's VAT Reg. No: 11644720010</p>
            </div>
          </div>

          <div className="invoice-title-box">
            <div className="invoice-title">
              የእጅ በእጅ ሽያጭ አባሪ ደረሰኝ <br />
              CASH SALES ATTACHMENT INVOICE
            </div>
          </div>

          <div className="details-grid">
            <div className="details-block">
              <p><span className="details-label">From:</span> ኩደጃ ትሬዲንግ ኃ/የተ/የግ/ማህበር</p>
              <p><span className="details-label">FS No.:</span> {invoiceData.fsNo || '........................................'}</p>
              <p><span className="details-label">Buyer's name:</span> {invoiceData.buyerName || '........................................'}</p>
              <p><span className="details-label">Trade name:</span> {invoiceData.buyerTradeName || '........................................'}</p>
              <p><span className="details-label">Buyer's TIN:</span> {invoiceData.buyerTin || '........................................'}</p>
              <p><span className="details-label">Buyer's VAT:</span> {invoiceData.buyerVat || '........................................'}</p>
              <p><span className="details-label">Address:</span> Zone: {invoiceData.address.zone || '.....'} Woreda: {invoiceData.address.Woreda || '.....'} House No: {invoiceData.address.houseNo || '.....'}</p>
            </div>
            <div className="details-block">
              <p><span className="details-label">Date:</span> {invoiceData.date}</p>
              <p><span className="details-label">Time:</span> {invoiceData.time}</p>
            </div>
          </div>

          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>ተ.ቁ.<br />S.No</th>
                <th>የዕቃው ዓይነት<br />Description</th>
                <th style={{ width: '60px' }}>መለኪያ<br />Unit</th>
                <th style={{ width: '60px' }}>ብዛት<br />Qty</th>
                <th style={{ width: '100px' }}>የአንዱ ዋጋ<br />Unit Price</th>
                <th style={{ width: '120px' }}>ጠቅላላ ዋጋ<br />Total Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td className="text-left">{item.description}</td>
                  <td>{item.unit || 'Pcs'}</td>
                  <td>{item.qty}</td>
                  <td>{item.unitPrice.toLocaleString()}</td>
                  <td>{(item.qty * item.unitPrice).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals-section">
            <table className="totals-table">
              <tbody>
                <tr>
                  <td className="label">ድምር<br />Total</td>
                  <td>{subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="label">የተ.እ.ታ.<br />VAT 15%</td>
                  <td>{vat.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="label">ጠቅላላ ድምር ከተ.እ.ታ. ጋር<br />Total (Incl. VAT)</td>
                  <td style={{ fontWeight: 'bold' }}>{total.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="amount-words" style={{ background: '#f8fafc', border: '2px solid #000', padding: '1rem', marginTop: '1rem' }}>
            <strong style={{ fontSize: '0.9rem', color: '#475569' }}>የገንዘቡ ልክ በፊደል / Amount In Words:</strong><br />
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '0.25rem', color: '#000' }}>
              {numberToWords(total)}
            </div>
          </div>

          <div className="payment-method-box">
            <strong>Mode of Payment:</strong>
            <label className="checkbox-custom">
              <input type="checkbox" checked={invoiceData.paymentMode === 'Cash'} readOnly /> Cash
            </label>
            <label className="checkbox-custom">
              <input type="checkbox" checked={invoiceData.paymentMode === 'Cheque'} readOnly /> Cheque
            </label>
            <span style={{ marginLeft: '1rem' }}>
              <strong>Cheque No.</strong> {invoiceData.chequeNo || '........................'}
            </span>
          </div>

          <div className="footer-section" style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <p style={{ display: 'flex', alignItems: 'baseline', width: '300px' }}>
              <span style={{ fontWeight: 'bold', minWidth: '100px' }}>{invoiceData.signatureLabel}:</span>
              <span style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '5px', paddingLeft: '5px', minHeight: '1.2em' }}>
                {invoiceData.preparedBy}
              </span>
            </p>
            <p style={{ display: 'flex', alignItems: 'baseline', width: '300px' }}>
              <span style={{ fontWeight: 'bold', minWidth: '110px' }}>Cashier's Sig.:</span>
              <span style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '5px', minHeight: '1.2em' }}></span>
            </p>
          </div>

          <div style={{ marginTop: '1rem', fontSize: '10px', textAlign: 'center', borderTop: '1px solid #000000ff', paddingTop: '0.5rem' }}>
            INVALID WITHOUT FISCAL RECEIPT ATTACHMENT<br />
            Distribution: Original - Customer | 1st Copy - Accounts |
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
