import React, { useState, useEffect } from 'react';
import logo from './assets/image.png';

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

  const handleInputChange = (e) => {
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
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now(), description: '', unit: 'Pcs', qty: 1, unitPrice: 0 }]);
  };

  const removeItem = (id) => {
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
    window.print();
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
      `}</style>
      {/* Editor Section */}
      <aside className="editor-section">
        <h1 className="editor-title">
          <span>📝</span> Sales Attachment
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>FS No.</label>
            <input type="text" name="fsNo" value={invoiceData.fsNo} onChange={handleInputChange} className="form-input" />
            <span className="help-text">Fiscal Serial Number from your cash register</span>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" name="date" value={invoiceData.date} onChange={handleInputChange} className="form-input" />
            <span className="help-text">Transaction date</span>
          </div>
        </div>

        <div className="form-group">
          <label>Buyer's Name</label>
          <input type="text" name="buyerName" value={invoiceData.buyerName} onChange={handleInputChange} className="form-input" placeholder="Enter buyer name" />
          <span className="help-text">Official name of the customer</span>
        </div>

        <div className="form-group">
          <label>Buyer's Trade Name</label>
          <input type="text" name="buyerTradeName" value={invoiceData.buyerTradeName} onChange={handleInputChange} className="form-input" />
          <span className="help-text">Business or Trading name</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Buyer's TIN</label>
            <input type="text" name="buyerTin" value={invoiceData.buyerTin} onChange={handleInputChange} className="form-input" />
            <span className="help-text">10-digit Tax Identification Number</span>
          </div>
          <div className="form-group">
            <label>Buyer's VAT</label>
            <input type="text" name="buyerVat" value={invoiceData.buyerVat} onChange={handleInputChange} className="form-input" />
            <span className="help-text">VAT Registration Number</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Zone/Ketema</label>
            <input type="text" name="address.zone" value={invoiceData.address.zone} onChange={handleInputChange} className="form-input" />
          </div>
          <div className="form-group">
            <label>Woreda</label>
            <input type="text" name="address.Woreda" value={invoiceData.address.Woreda} onChange={handleInputChange} className="form-input" />
          </div>
          <div className="form-group">
            <label>House No.</label>
            <input type="text" name="address.houseNo" value={invoiceData.address.houseNo} onChange={handleInputChange} className="form-input" />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Payment Method</label>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <label className="checkbox-custom">
              <input type="radio" name="paymentMode" value="Cash" checked={invoiceData.paymentMode === 'Cash'} onChange={handleInputChange} />
              Cash
            </label>
            <label className="checkbox-custom">
              <input type="radio" name="paymentMode" value="Cheque" checked={invoiceData.paymentMode === 'Cheque'} onChange={handleInputChange} />
              Cheque
            </label>
          </div>
          {invoiceData.paymentMode === 'Cheque' && (
            <input type="text" name="chequeNo" value={invoiceData.chequeNo} onChange={handleInputChange} className="form-input" style={{ marginTop: '0.5rem' }} placeholder="Enter Cheque Number" />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Signature Label</label>
            <input type="text" name="signatureLabel" value={invoiceData.signatureLabel} onChange={handleInputChange} className="form-input" placeholder="e.g. Prepared by" />
          </div>
          <div className="form-group">
            <label>Prepared By (Name)</label>
            <input type="text" name="preparedBy" value={invoiceData.preparedBy} onChange={handleInputChange} className="form-input" placeholder="Name" />
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
                <th style={{ width: '50px' }}></th>
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
                      className="form-input"
                      placeholder="Product description..."
                    />
                  </td>
                  <td style={{ width: '90px' }}>
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                      className="form-input"
                      placeholder="Pcs/Kg"
                    />
                  </td>
                  <td style={{ width: '90px' }}>
                    <input
                      type="number"
                      value={item.qty === 0 ? '' : item.qty}
                      onChange={(e) => handleItemChange(item.id, 'qty', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      className="form-input"
                      placeholder="0"
                    />
                  </td>
                  <td style={{ width: '130px' }}>
                    <input
                      type="number"
                      value={item.unitPrice === 0 ? '' : item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      className="form-input"
                      placeholder="0.00"
                    />
                  </td>
                  <td style={{ width: '50px' }}>
                    <button onClick={() => removeItem(item.id)} className="btn btn-remove" style={{ width: '100%', height: '45px' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addItem} className="btn btn-add">+ Add Item</button>
        <button
          onClick={() => { if (confirm('Clear all data?')) { setItems([{ id: Date.now(), description: '', unit: 'Pcs', qty: 1, unitPrice: 0 }]); setInvoiceData(prev => ({ ...prev, buyerName: '', buyerTradeName: '', buyerTin: '', buyerVat: '', address: { zone: '', kebele: '', houseNo: '' } })); } }}
          className="btn btn-reset"
        >
          Reset Form
        </button>

        <div className="btn-print-container" style={{ marginTop: '2rem' }}>
          <button onClick={handlePrint} className="btn btn-primary" style={{ width: '100%' }}>
            Export & Print
          </button>
        </div>
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
