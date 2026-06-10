import React, { useState, useEffect } from 'react';
import logo from './assets/image.png';
import { 
  saveHistoryOnline, 
  updateHistoryOnline, 
  fetchHistoryOnline, 
  deleteHistoryOnline, 
  isFirebaseConfigured,
  saveProductOnline,
  updateProductOnline,
  fetchProductsOnline,
  deleteProductOnline
} from './firebase';

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

// Utility to format YYYY-MM-DD to DD-MM-YYYY
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

// Utility to format Date object to DD-MM-YYYY HH:MM
const formatDateTime = (date = new Date()) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
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
  const [viewMode, setViewMode] = useState('edit'); // 'edit', 'history', or 'stock'
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Stock Management States
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({ id: null, name: '', unit: 'Pcs', unitPrice: '', stockQty: '', minStockQty: 2, category: 'General' });
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  // Load history and products from localStorage and Cloud on mount
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

    const savedProducts = localStorage.getItem('stock_products');
    if (savedProducts) {
      try {
        setProducts(JSON.parse(savedProducts));
      } catch (e) {
        console.error('Failed to load local products', e);
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
          console.error("Cloud sync history failed silently in background:", error);
        }

        try {
          const cloudProducts = await fetchProductsOnline();
          if (cloudProducts && cloudProducts.length > 0) {
            setProducts(cloudProducts);
            localStorage.setItem('stock_products', JSON.stringify(cloudProducts));
          }
        } catch (error) {
          console.error("Cloud sync products failed silently in background:", error);
        }
      }
    };

    syncWithCloud();
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('invoice_history', JSON.stringify(history));
  }, [history]);

  // Save products to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('stock_products', JSON.stringify(products));
  }, [products]);

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
    if (field === 'description') {
      setActiveDropdownId(id);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setActiveDropdownId(null);
    }, 200);
  };

  const selectProductForInvoiceItem = (itemId, product) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          description: product.name,
          unit: product.unit || 'Pcs',
          unitPrice: product.unitPrice || 0
        };
      }
      return item;
    }));
    setActiveDropdownId(null);
  };

  const getProductStockInfo = (description) => {
    if (!description || !description.trim()) return null;
    const prod = products.find(p => p.name.trim().toLowerCase() === description.trim().toLowerCase());
    return prod || null;
  };

  const adjustStock = async (newItems, oldItems = []) => {
    const normalize = (name) => (name || '').trim().toLowerCase();

    // Map of old quantities: normalize(description) -> quantity
    const oldMap = {};
    oldItems.forEach(item => {
      const name = normalize(item.description);
      if (name) {
        oldMap[name] = (oldMap[name] || 0) + (parseFloat(item.qty) || 0);
      }
    });

    // Map of new quantities: normalize(description) -> quantity
    const newMap = {};
    newItems.forEach(item => {
      const name = normalize(item.description);
      if (name) {
        newMap[name] = (newMap[name] || 0) + (parseFloat(item.qty) || 0);
      }
    });

    const allNames = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    let updatedProducts = [...products];

    for (const name of allNames) {
      const oldQty = oldMap[name] || 0;
      const newQty = newMap[name] || 0;
      const diff = newQty - oldQty;

      if (diff === 0) continue;

      let prodIndex = updatedProducts.findIndex(p => normalize(p.name) === name);

      if (prodIndex === -1 && diff > 0) {
        // Product doesn't exist, create it with 5 units starting capacity
        const matchedItem = newItems.find(item => normalize(item.description) === name);
        const unit = matchedItem ? matchedItem.unit : 'Pcs';
        const unitPrice = matchedItem ? parseFloat(matchedItem.unitPrice) || 0 : 0;

        const newProduct = {
          id: 'prod_' + Date.now() + Math.random().toString(36).substr(2, 5),
          name: matchedItem ? matchedItem.description.trim() : name,
          unit: unit,
          unitPrice: unitPrice || 0,
          stockQty: Math.max(0, 5 - diff), // default starting stock is 5
          minStockQty: 2,
          category: 'General'
        };

        updatedProducts.push(newProduct);

        if (isFirebaseConfigured) {
          const cloudId = await saveProductOnline({
            name: newProduct.name,
            unit: newProduct.unit,
            unitPrice: newProduct.unitPrice,
            stockQty: newProduct.stockQty,
            minStockQty: newProduct.minStockQty,
            category: newProduct.category
          });
          if (cloudId) {
            newProduct.id = cloudId;
          }
        }
      } else if (prodIndex !== -1) {
        const product = updatedProducts[prodIndex];
        const newStockQty = Math.max(0, (parseFloat(product.stockQty) || 0) - diff);

        const updatedProduct = {
          ...product,
          stockQty: newStockQty
        };

        updatedProducts[prodIndex] = updatedProduct;

        if (isFirebaseConfigured) {
          await updateProductOnline(product.id, {
            name: updatedProduct.name,
            unit: updatedProduct.unit,
            unitPrice: updatedProduct.unitPrice,
            stockQty: updatedProduct.stockQty,
            minStockQty: updatedProduct.minStockQty,
            category: updatedProduct.category
          });
        }
      }
    }

    setProducts(updatedProducts);
    localStorage.setItem('stock_products', JSON.stringify(updatedProducts));
  };

  const deleteProduct = async (id) => {
    if (confirm('Are you sure you want to delete this product from stock?')) {
      const updated = products.filter(p => p.id !== id);
      setProducts(updated);
      localStorage.setItem('stock_products', JSON.stringify(updated));
      if (isFirebaseConfigured) {
        await deleteProductOnline(id);
      }
    }
  };

  const saveOrUpdateProduct = async (productData) => {
    if (!productData.name || !productData.name.trim()) {
      alert('Product name is required.');
      return;
    }

    setIsSyncing(true);

    const priceVal = productData.unitPrice === '' ? 0 : parseFloat(productData.unitPrice);
    const stockVal = productData.stockQty === '' ? 0 : parseFloat(productData.stockQty);
    const minVal = productData.minStockQty === '' ? 0 : parseFloat(productData.minStockQty);

    const parsedProduct = {
      name: productData.name.trim(),
      unit: productData.unit || 'Pcs',
      unitPrice: priceVal || 0,
      stockQty: stockVal || 0,
      minStockQty: minVal || 0,
      category: productData.category || 'General'
    };

    let updatedProducts = [...products];

    if (productData.id) {
      updatedProducts = products.map(p => p.id === productData.id ? { ...p, ...parsedProduct } : p);
      setProducts(updatedProducts);
      localStorage.setItem('stock_products', JSON.stringify(updatedProducts));
      if (isFirebaseConfigured) {
        await updateProductOnline(productData.id, parsedProduct);
      }
    } else {
      const exists = products.some(p => p.name.trim().toLowerCase() === parsedProduct.name.toLowerCase());
      if (exists) {
        alert('A product with this name already exists in stock.');
        setIsSyncing(false);
        return;
      }

      const tempId = 'prod_' + Date.now();
      const newProduct = { id: tempId, ...parsedProduct };
      updatedProducts = [...products, newProduct];
      setProducts(updatedProducts);
      localStorage.setItem('stock_products', JSON.stringify(updatedProducts));

      if (isFirebaseConfigured) {
        const cloudId = await saveProductOnline(parsedProduct);
        if (cloudId) {
          setProducts(prev => prev.map(p => p.id === tempId ? { ...p, id: cloudId } : p));
          const syncedLocal = updatedProducts.map(p => p.id === tempId ? { ...p, id: cloudId } : p);
          localStorage.setItem('stock_products', JSON.stringify(syncedLocal));
        }
      }
    }

    setIsSyncing(false);
    setShowProductModal(false);
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
    window.print();
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
      timestamp: editingId ? `${formatDateTime()} (Edited)` : formatDateTime()
    };

    // Calculate changes in stock
    const oldInvoice = editingId ? history.find(item => item.id === editingId) : null;
    const oldItems = oldInvoice ? oldInvoice.items : [];
    await adjustStock(items, oldItems);

    if (editingId) {
      setHistory(prev => prev.map(item =>
        item.id === editingId ? { ...item, ...invoiceToSave } : item
      ));

      if (isFirebaseConfigured) {
        await updateHistoryOnline(editingId, invoiceToSave);
      }
    } else {
      const tempId = Date.now();
      const historyItem = { id: tempId, ...invoiceToSave };
      setHistory(prev => [historyItem, ...prev]);

      if (isFirebaseConfigured) {
        const newId = await saveHistoryOnline(invoiceToSave);
        if (newId) {
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
    setViewMode('edit');
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

      const invoiceToDelete = history.find(item => item.id === id);
      if (invoiceToDelete) {
        await adjustStock([], invoiceToDelete.items);
      }

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

        .dropdown-item-hover {
          transition: background-color 0.2s;
        }

        .dropdown-item-hover:hover {
          background-color: #f1f5f9 !important;
        }

        .product-card-hover {
          transition: all 0.2s;
        }

        .product-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          border-color: #6366f1 !important;
        }

        .dashboard-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .dashboard-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.12) !important;
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
          <button
            className={`tab-btn ${viewMode === 'stock' ? 'active' : ''}`}
            onClick={() => setViewMode('stock')}
          >
            📦 Stock Management
          </button>
        </div>

        {viewMode === 'edit' && (
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
                  🔓 Unlock & Edit
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
                      <td style={{ flex: 2, position: 'relative' }}>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                          onFocus={() => { if (!isReadOnly) setActiveDropdownId(item.id); }}
                          onBlur={handleBlur}
                          disabled={isReadOnly}
                          className="form-input"
                          placeholder="Product description..."
                          autoComplete="off"
                        />
                        {item.description && (
                          <div style={{ marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                            {(() => {
                              const prod = getProductStockInfo(item.description);
                              if (prod) {
                                if (prod.stockQty <= 0) {
                                  return <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ef4444', background: '#fee2e2', padding: '0.15rem 0.5rem', borderRadius: '0.25rem' }}>⚠️ Out of Stock! (0 remaining)</span>;
                                } else if (prod.stockQty <= prod.minStockQty) {
                                  return <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#d97706', background: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: '0.25rem' }}>⚠️ Low Stock! ({prod.stockQty} remaining)</span>;
                                } else {
                                  return <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981', background: '#d1fae5', padding: '0.15rem 0.5rem', borderRadius: '0.25rem' }}>✓ In Stock ({prod.stockQty} remaining)</span>;
                                }
                              } else {
                                return <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#8b5cf6', background: '#ede9fe', padding: '0.15rem 0.5rem', borderRadius: '0.25rem' }}>✨ New Product (Will auto-create with 5 units stock)</span>;
                              }
                            })()}
                          </div>
                        )}
                        {!isReadOnly && activeDropdownId === item.id && (
                          <div className="autocomplete-dropdown" style={{
                            position: 'absolute',
                            top: '46px',
                            left: 0,
                            right: 0,
                            background: 'white',
                            border: '1px solid #cbd5e1',
                            borderRadius: '0.75rem',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            zIndex: 100,
                            maxHeight: '200px',
                            overflowY: 'auto'
                          }}>
                            {(() => {
                              const search = (item.description || '').toLowerCase();
                              const matches = products.filter(p => 
                                p.name.toLowerCase().includes(search)
                              );
                              
                              if (matches.length === 0) {
                                return (
                                  <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                                    No matching products in stock (will be created as new)
                                  </div>
                                );
                              }
                              
                              return matches.map(prod => (
                                <div
                                  key={prod.id}
                                  onMouseDown={() => selectProductForInvoiceItem(item.id, prod)}
                                  style={{
                                    padding: '0.6rem 1rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.9rem'
                                  }}
                                  className="dropdown-item-hover"
                                >
                                  <span style={{ fontWeight: '600', color: '#1e293b' }}>{prod.name}</span>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    padding: '0.2rem 0.5rem', 
                                    borderRadius: '1rem',
                                    background: prod.stockQty <= 0 ? '#fee2e2' : (prod.stockQty <= prod.minStockQty ? '#fef3c7' : '#f1f5f9'),
                                    color: prod.stockQty <= 0 ? '#ef4444' : (prod.stockQty <= prod.minStockQty ? '#b45309' : '#475569'),
                                    fontWeight: '700'
                                  }}>
                                    Stock: {prod.stockQty} {prod.unit}
                                  </span>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
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
                <input type="text" name="signatureLabel" value={invoiceData.signatureLabel} readOnly className="form-input" style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }} placeholder="e.g. Prepared by" />
              </div>
              <div className="form-group">
                <label>Prepared By (Name)</label>
                <textarea name="preparedBy" value={invoiceData.preparedBy} onChange={handleInputChange} disabled={isReadOnly} className="form-input" placeholder="Name" style={{ resize: 'none', height: '42px', overflow: 'hidden' }} />
              </div>
            </div>

            <div className="btn-print-container" style={{ marginTop: '2rem' }}>
              <button onClick={handlePrint} className="btn btn-primary" style={{ width: '100%' }}>
                {isReadOnly ? '🖨️ Print Again' : (editingId ? '💾 Update & Print ' : '📤 Export ')}
              </button>
            </div>
          </>
        )}

        {viewMode === 'history' && (
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

        {viewMode === 'stock' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h1 className="editor-title" style={{ margin: 0 }}>
                <span>📦</span> Stock management
              </h1>
              {!showProductModal && (
                <button 
                  onClick={() => {
                    setProductForm({ id: null, name: '', unit: 'Pcs', unitPrice: '', stockQty: '', minStockQty: 2, category: 'General' });
                    setShowProductModal(true);
                  }} 
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  ➕ Add Product
                </button>
              )}
            </div>

            {showProductModal && (
              <div style={{
                background: '#f8fafc',
                border: '2px solid #6366f1',
                borderRadius: '1.25rem',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.1)'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1rem', color: '#4f46e5' }}>
                  {productForm.id ? '✏️ Edit Product' : '➕ Add New Product'}
                </h3>
                
                <div className="form-group">
                  <label>Product Name *</label>
                  <input 
                    type="text" 
                    value={productForm.name} 
                    onChange={(e) => setProductForm(p => ({ ...p, name: e.target.value }))}
                    className="form-input" 
                    placeholder="e.g. Industrial Bolt"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Unit Type</label>
                    <input 
                      type="text" 
                      value={productForm.unit} 
                      onChange={(e) => setProductForm(p => ({ ...p, unit: e.target.value }))}
                      className="form-input" 
                      placeholder="Pcs, Kg, Box..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit Price (Optional)</label>
                    <input 
                      type="number" 
                      value={productForm.unitPrice} 
                      onChange={(e) => setProductForm(p => ({ ...p, unitPrice: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                      className="form-input" 
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Stock Qty</label>
                    <input 
                      type="number" 
                      value={productForm.stockQty} 
                      onChange={(e) => setProductForm(p => ({ ...p, stockQty: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                      className="form-input" 
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Alert Threshold</label>
                    <input 
                      type="number" 
                      value={productForm.minStockQty} 
                      onChange={(e) => setProductForm(p => ({ ...p, minStockQty: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                      className="form-input" 
                      placeholder="2"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    onClick={() => saveOrUpdateProduct(productForm)} 
                    className="btn btn-primary" 
                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem' }}
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setShowProductModal(false)} 
                    className="btn btn-reset" 
                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.9rem', marginTop: 0 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="🔍 Search products..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.95rem', padding: '0.6rem 1rem' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {(() => {
                const filtered = products.filter(p => 
                  p.name.toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No products found.</p>
                    </div>
                  );
                }

                return filtered.map(prod => {
                  const qty = parseFloat(prod.stockQty) || 0;
                  const isLow = qty <= prod.minStockQty && qty > 0;
                  const isOut = qty <= 0;
                  
                  return (
                    <div 
                      key={prod.id} 
                      style={{
                        background: isOut ? '#fff5f5' : (isLow ? '#fffdf0' : 'white'),
                        border: `2px solid ${isOut ? '#fecaca' : (isLow ? '#fde68a' : '#e2e8f0')}`,
                        padding: '0.9rem 1.1rem',
                        borderRadius: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'box-shadow 0.2s, transform 0.15s',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                      }}
                      className="product-card-hover"
                    >
                      {/* Left: product info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '0.6rem', flexShrink: 0,
                          background: isOut ? '#fee2e2' : (isLow ? '#fef3c7' : '#ede9fe'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem'
                        }}>
                          {isOut ? '❌' : (isLow ? '⚠️' : '📦')}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                            {prod.unitPrice ? `${prod.unitPrice} ETB` : 'Price not set'} &nbsp;·&nbsp; {prod.unit} &nbsp;·&nbsp; {prod.category || 'General'}
                          </div>
                        </div>
                      </div>

                      {/* Right: stock badge + action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.75rem' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.3rem 0.65rem', 
                          borderRadius: '2rem',
                          fontWeight: '800',
                          whiteSpace: 'nowrap',
                          background: isOut ? '#fee2e2' : (isLow ? '#fef3c7' : '#d1fae5'),
                          color: isOut ? '#ef4444' : (isLow ? '#b45309' : '#065f46')
                        }}>
                          {isOut ? '0 – Out' : (isLow ? `⚠ ${qty} ${prod.unit}` : `${qty} ${prod.unit}`)}
                        </span>

                        {/* Edit Button */}
                        <button 
                          title="Edit product"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProductForm({
                              id: prod.id,
                              name: prod.name,
                              unit: prod.unit,
                              unitPrice: prod.unitPrice || '',
                              stockQty: prod.stockQty,
                              minStockQty: prod.minStockQty,
                              category: prod.category || 'General'
                            });
                            setShowProductModal(true);
                          }}
                          style={{
                            background: '#ede9fe',
                            color: '#7c3aed',
                            border: 'none',
                            borderRadius: '0.5rem',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            transition: 'background 0.15s, transform 0.1s',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ddd6fe'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          ✏️
                        </button>

                        {/* Delete Button */}
                        <button 
                          title="Delete product"
                          onClick={(e) => { e.stopPropagation(); deleteProduct(prod.id); }} 
                          style={{
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '0.5rem',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            transition: 'background 0.15s, transform 0.1s',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </aside>

      {/* Preview Section */}
      {viewMode === 'stock' ? (
        <main className="preview-section" style={{ background: '#f8fafc', padding: '2rem' }}>
          <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '1.5rem' }}>
              📊 Inventory Analytics & Health
            </h2>
            
            {/* Metric Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="dashboard-card" style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid #e2e8f0',
                borderLeft: '5px solid #4f46e5',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Products</span>
                <span style={{ fontSize: '2rem', fontWeight: '800', color: '#4f46e5' }}>{products.length}</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Unique items registered</span>
              </div>

              <div className="dashboard-card" style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid #e2e8f0',
                borderLeft: '5px solid #10b981',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Stock Value</span>
                <span style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981' }}>
                  {products.reduce((sum, p) => sum + ((parseFloat(p.stockQty) || 0) * (parseFloat(p.unitPrice) || 0)), 0).toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: '700' }}>ETB</span>
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Based on current unit prices</span>
              </div>

              <div className="dashboard-card" style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid #e2e8f0',
                borderLeft: '5px solid #ef4444',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Low/Out of Stock</span>
                <span style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444' }}>
                  {products.filter(p => (parseFloat(p.stockQty) || 0) <= p.minStockQty).length}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Items requiring attention</span>
              </div>
            </div>

            {/* Restock Alerts & Stock list summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
              
              {/* Detailed Stock Status Bars */}
              <div style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b', marginBottom: '1.25rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  📈 Stock Capacity Levels
                </h3>
                
                {products.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>No products to display capacity.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {products.map(p => {
                      const qty = parseFloat(p.stockQty) || 0;
                      const capMax = Math.max(100, p.minStockQty * 10, qty);
                      const percent = Math.min(100, (qty / capMax) * 100);
                      let barColor = '#10b981';
                      if (qty <= 0) barColor = '#ef4444';
                      else if (qty <= p.minStockQty) barColor = '#f59e0b';
                      
                      return (
                        <div key={p.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#334155' }}>{p.name}</span>
                            <span style={{ color: barColor }}>{qty} / {capMax} {p.unit}</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '1rem', overflow: 'hidden' }}>
                            <div style={{ width: `${percent}%`, height: '100%', background: barColor, borderRadius: '1rem', transition: 'width 0.5s ease-out' }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Low Stock Alerts Box */}
              <div style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '1.25rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ef4444', marginBottom: '1.25rem', borderBottom: '2px solid #fee2e2', paddingBottom: '0.5rem' }}>
                  ⚠️ Urgent Restock Alerts
                </h3>
                
                {(() => {
                  const lowItems = products.filter(p => (parseFloat(p.stockQty) || 0) <= p.minStockQty);
                  
                  if (lowItems.length === 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '2rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</span>
                        <p style={{ color: '#10b981', fontWeight: '700', fontSize: '0.9rem' }}>All Stock Levels Healthy</p>
                        <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>No restock alerts at this time.</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', maxHeight: '400px' }}>
                      {lowItems.map(p => {
                        const qty = parseFloat(p.stockQty) || 0;
                        return (
                          <div key={p.id} style={{
                            background: qty <= 0 ? '#fef2f2' : '#fffbeb',
                            border: `1px solid ${qty <= 0 ? '#fecaca' : '#fef3c7'}`,
                            padding: '0.75rem',
                            borderRadius: '0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.85rem' }}>{p.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Limit: {p.minStockQty} {p.unit}</div>
                            </div>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: '800',
                              color: qty <= 0 ? '#ef4444' : '#d97706'
                            }}>
                              {qty <= 0 ? 'OUT' : `${qty} left`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </main>
      ) : (
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
                <p><span className="details-label">Date:</span> {formatDate(invoiceData.date)}</p>
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
      )}
    </div>
  );
}

export default App;
