"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Trash2, Edit3, QrCode, Printer,
  Download, RefreshCw, X, Grid, Check, Loader2, Info
} from "lucide-react";
import { useRouter } from "next/navigation";

interface TableData {
  _id: string;
  tableNumber: string;
  tableName?: string;
  qrToken: string;
  qrImageUrl?: string;
  status: "available" | "occupied" | "reserved";
  createdAt: string;
}

interface Perms {
  role: string;
  isSuperAdmin: boolean;
  permissions: Record<string, any>;
}

interface TablesClientProps {
  initialTables: TableData[];
  perms: Perms;
}

export default function TablesClient({ initialTables, perms }: TablesClientProps) {
  const router = useRouter();

  const canEdit = perms.isSuperAdmin || Boolean(perms.permissions?.tables?.edit);
  const canCreate = perms.isSuperAdmin || Boolean(perms.permissions?.tables?.create);
  const canDelete = perms.isSuperAdmin || Boolean(perms.permissions?.tables?.delete);

  // States
  const [tables, setTables] = useState<TableData[]>(initialTables);
  const [activeOrderCounts, setActiveOrderCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [enlargedQrTable, setEnlargedQrTable] = useState<TableData | null>(null);

  // Forms
  const [addForm, setAddForm] = useState({ tableNumber: "", tableName: "", status: "available" });
  const [bulkForm, setBulkForm] = useState({ prefix: "Table ", start: 1, count: 5 });
  const [editForm, setEditForm] = useState({ tableNumber: "", tableName: "", status: "available" });

  // Fetch active order counts
  const fetchActiveOrders = async () => {
    try {
      const res = await fetch("/api/admin/tables/orders");
      if (res.ok) {
        const data = await res.json();
        setActiveOrderCounts(data.counts || {});
      }
    } catch (err) {
      console.error("Failed to fetch active order counts:", err);
    }
  };

  useEffect(() => {
    fetchActiveOrders();
    // Poll counts every 20 seconds
    const interval = setInterval(fetchActiveOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const notifyError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 4000);
  };

  // Add table handler
  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.tableNumber.trim()) return;

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: addForm.tableNumber.trim(),
          tableName: addForm.tableName.trim(),
          status: addForm.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add table");

      setTables(prev => [...prev, data.table].sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })));
      setShowAddModal(false);
      setAddForm({ tableNumber: "", tableName: "", status: "available" });
      notifySuccess(`Table ${data.table.tableNumber} added successfully.`);
    } catch (err: any) {
      notifyError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Bulk generate handler
  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulk: true,
          prefix: bulkForm.prefix,
          start: Number(bulkForm.start) || 1,
          count: Number(bulkForm.count) || 5,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to bulk generate");

      if (data.tables && data.tables.length > 0) {
        setTables(prev => {
          const newTables = [...prev];
          data.tables.forEach((t: TableData) => {
            if (!newTables.find(x => x._id === t._id)) {
              newTables.push(t);
            }
          });
          return newTables.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
        });
        notifySuccess(`Successfully generated ${data.count} tables.`);
      } else {
        notifySuccess("No new tables were generated (possibly duplicate table numbers).");
      }
      setShowBulkModal(false);
      setBulkForm({ prefix: "Table ", start: tables.length + 1, count: 5 });
    } catch (err: any) {
      notifyError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Edit table handler
  const handleEditTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/tables/${selectedTable._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: editForm.tableNumber.trim(),
          tableName: editForm.tableName.trim(),
          status: editForm.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update table");

      setTables(prev => prev.map(t => t._id === selectedTable._id ? data.table : t).sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })));
      setShowEditModal(false);
      setSelectedTable(null);
      notifySuccess("Table details updated.");
    } catch (err: any) {
      notifyError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete table handler
  const handleDeleteTable = async (id: string, num: string) => {
    if (!confirm(`Are you sure you want to delete table "${num}"?`)) return;

    try {
      const res = await fetch(`/api/admin/tables/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete table");

      setTables(prev => prev.filter(t => t._id !== id));
      notifySuccess(`Table "${num}" deleted successfully.`);
    } catch (err: any) {
      notifyError(err.message);
    }
  };

  // Regenerate token handler
  const handleRegenerateToken = async (table: TableData) => {
    if (!confirm(`Regenerate QR code for Table "${table.tableNumber}"? The old QR code link will no longer work.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tables/${table._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateToken: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate QR");

      setTables(prev => prev.map(t => t._id === table._id ? data.table : t));
      if (enlargedQrTable && enlargedQrTable._id === table._id) {
        setEnlargedQrTable(data.table);
      }
      notifySuccess(`QR Code regenerated for Table "${table.tableNumber}".`);
    } catch (err: any) {
      notifyError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (table: TableData) => {
    setSelectedTable(table);
    setEditForm({
      tableNumber: table.tableNumber,
      tableName: table.tableName || "",
      status: table.status,
    });
    setShowEditModal(true);
  };

  // Print single QR
  const printSingleQR = (table: TableData) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const host = window.location.origin;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR - Table ${table.tableNumber}</title>
          <style>
            body { font-family: 'DM Sans', sans-serif; text-align: center; padding: 40px; }
            .card { border: 2px solid #ea580c; border-radius: 16px; padding: 30px; display: inline-block; max-width: 320px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .logo { font-size: 24px; font-weight: 800; color: #ea580c; margin-bottom: 15px; text-transform: uppercase; }
            img { width: 220px; height: 220px; margin: 15px auto; display: block; }
            h2 { margin: 10px 0; font-size: 28px; color: #111827; }
            p { margin: 5px 0; color: #6b7280; font-size: 14px; }
            .scan-text { background: #fff7ed; color: #ea580c; font-weight: 700; padding: 6px 12px; border-radius: 20px; display: inline-block; margin-top: 15px; font-size: 12px; border: 1px solid #fed7aa; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">Damru By Namo</div>
            <h2>Table ${table.tableNumber}</h2>
            ${table.tableName ? `<p>${table.tableName}</p>` : ""}
            <img src="${table.qrImageUrl}" alt="Table QR" />
            <div class="scan-text">SCAN TO ORDER MENU</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print all QRs
  const printAllQRs = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let cardsHtml = "";
    tables.forEach(table => {
      cardsHtml += `
        <div class="card">
          <div class="logo">Damru By Namo</div>
          <h2>Table ${table.tableNumber}</h2>
          ${table.tableName ? `<p class="tbl-name">${table.tableName}</p>` : "<p class='tbl-name'>&nbsp;</p>"}
          <img src="${table.qrImageUrl}" alt="Table QR" />
          <div class="scan-text">SCAN TO ORDER MENU</div>
        </div>
      `;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Print All Table QR Codes</title>
          <style>
            body { font-family: 'DM Sans', sans-serif; background: #fff; margin: 0; padding: 20px; }
            .print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; justify-items: center; }
            .card { border: 2px solid #ea580c; border-radius: 16px; padding: 20px; text-align: center; width: 260px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); page-break-inside: avoid; background: #fff; margin-bottom: 20px; }
            .logo { font-size: 20px; font-weight: 800; color: #ea580c; margin-bottom: 10px; text-transform: uppercase; }
            img { width: 170px; height: 170px; margin: 10px auto; display: block; }
            h2 { margin: 5px 0; font-size: 24px; color: #111827; }
            .tbl-name { margin: 2px 0; color: #6b7280; font-size: 13px; min-height: 18px; }
            .scan-text { background: #fff7ed; color: #ea580c; font-weight: 700; padding: 5px 10px; border-radius: 20px; display: inline-block; margin-top: 10px; font-size: 11px; border: 1px solid #fed7aa; }
            @media print {
              body { padding: 0; }
              .print-grid { gap: 15px; }
            }
          </style>
        </head>
        <body>
          <div class="print-grid">
            ${cardsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Download QR image
  const downloadQR = async (table: TableData) => {
    try {
      const res = await fetch(table.qrImageUrl!);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `table-${table.tableNumber}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: open image in new tab if cors restricts
      window.open(table.qrImageUrl, "_blank");
    }
  };

  // Filters and sorting
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const matchSearch =
        t.tableNumber.toLowerCase().includes(search.toLowerCase()) ||
        (t.tableName && t.tableName.toLowerCase().includes(search.toLowerCase()));

      const matchStatus = statusFilter === "all" || t.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [tables, search, statusFilter]);

  // Statistics calculations
  const stats = useMemo(() => {
    const total = tables.length;
    const available = tables.filter(t => t.status === "available").length;
    const occupied = tables.filter(t => t.status === "occupied").length;
    const reserved = tables.filter(t => t.status === "reserved").length;
    const activeOrders = Object.values(activeOrderCounts).reduce((sum, count) => sum + count, 0);

    return { total, available, occupied, reserved, activeOrders };
  }, [tables, activeOrderCounts]);

  return (
    <>
      {/* Messages */}
      {successMsg && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 9999, background: "#f0fdf4", border: "1.5px solid #bbf7d0", color: "#16a34a", padding: "12px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <Check size={16} /> <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 9999, background: "#fef2f2", border: "1.5px solid #fecaca", color: "#dc2626", padding: "12px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <X size={16} /> <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{errorMsg}</span>
        </div>
      )}

      {/* Stat Bar */}
      <div className="user-stats" style={{ marginBottom: 8 }}>
        <div className="user-stat">
          <span className="us-value" style={{ color: "#374151" }}>{stats.total}</span>
          <span className="us-label">Total Tables</span>
        </div>
        <div className="user-stat">
          <span className="us-value" style={{ color: "#16a34a" }}>{stats.available}</span>
          <span className="us-label">Available</span>
        </div>
        <div className="user-stat">
          <span className="us-value" style={{ color: "#dc2626" }}>{stats.occupied}</span>
          <span className="us-label">Occupied</span>
        </div>
        <div className="user-stat">
          <span className="us-value" style={{ color: "#2563eb" }}>{stats.reserved}</span>
          <span className="us-label">Reserved</span>
        </div>
        <div className="user-stat">
          <span className="us-value" style={{ color: "#ea580c" }}>{stats.activeOrders}</span>
          <span className="us-label">Active Orders</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="searchbox">
            <Search size={14} className="search-ic" />
            <input
              className="search-inp"
              placeholder="Search table number or label..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="status-tabs">
            {[
              { key: "all", label: "All Tables" },
              { key: "available", label: "Available" },
              { key: "occupied", label: "Occupied" },
              { key: "reserved", label: "Reserved" },
            ].map(tab => (
              <button
                key={tab.key}
                className={`stab${statusFilter === tab.key ? " stab-active" : ""}`}
                onClick={() => setStatusFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-right">
          {canCreate && (
            <>
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={15} /> Add Table
              </button>
              <button className="btn-outline" onClick={() => { setBulkForm({ prefix: "Table ", start: tables.length + 1, count: 5 }); setShowBulkModal(true); }}>
                <Grid size={15} /> Bulk Generate
              </button>
            </>
          )}
          {tables.length > 0 && (
            <button className="btn-outline" onClick={printAllQRs}>
              <Printer size={15} /> Print All QRs
            </button>
          )}
        </div>
      </div>

      {/* Tables Grid */}
      {filteredTables.length === 0 ? (
        <div className="card" style={{ padding: "60px 20px" }}>
          <div className="empty-state">
            <QrCode size={48} />
            <p style={{ marginTop: 8 }}>{search || statusFilter !== "all" ? "No tables match your search/filter criteria." : "No tables added yet."}</p>
          </div>
        </div>
      ) : (
        <div className="tables-grid">
          {filteredTables.map(table => {
            const activeOrders = activeOrderCounts[table.tableNumber] || 0;
            return (
              <div key={table._id} className="table-card">
                {/* Header */}
                <div className="table-card-header">
                  <div className="table-info-left">
                    <span className="table-num-txt">Table {table.tableNumber}</span>
                    {table.tableName && <span className="table-name-txt">{table.tableName}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                    <span className={`table-status-badge status-${table.status}`}>
                      <span className="status-dot" style={{ background: "currentColor" }}></span>
                      {table.status.toUpperCase()}
                    </span>
                    {activeOrders > 0 && (
                      <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: 12, fontSize: "0.68rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        🔥 {activeOrders} Active Order{activeOrders !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* QR Code Container */}
                <div className="table-qr-box" onClick={() => setEnlargedQrTable(table)}>
                  {table.qrImageUrl ? (
                    <>
                      <img src={table.qrImageUrl} alt={`Table ${table.tableNumber} QR`} className="table-qr-img" />
                      <div className="qr-overlay-hover">
                        <QrCode size={20} />
                        <span>View Details</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: "#9ca3af", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <Loader2 className="animate-spin" size={20} />
                      <span style={{ fontSize: "0.75rem" }}>Generating QR...</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="table-card-footer">
                  <div className="action-row">
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="action-btn-sm" title="Print QR Code" onClick={() => printSingleQR(table)}>
                        <Printer size={13} />
                      </button>
                      <button className="action-btn-sm" title="Download QR PNG" onClick={() => downloadQR(table)}>
                        <Download size={13} />
                      </button>
                      {canEdit && (
                        <button className="action-btn-sm" title="Regenerate QR Token" onClick={() => handleRegenerateToken(table)}>
                          <RefreshCw size={13} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {canEdit && (
                        <button className="action-btn-sm" title="Edit details" onClick={() => openEditModal(table)}>
                          <Edit3 size={13} /> Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="action-btn-sm"
                          title="Delete table"
                          style={{ color: "#dc2626", borderColor: "#fecaca" }}
                          onClick={() => handleDeleteTable(table._id, table.tableNumber)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="tables-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="tables-modal" onClick={e => e.stopPropagation()}>
            <div className="tables-modal-header">
              <span className="tables-modal-title">Add New Table</span>
              <button className="tables-modal-close" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddTable} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Table Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 15, T-2, VIP-1"
                  required
                  value={addForm.tableNumber}
                  onChange={e => setAddForm(p => ({ ...p, tableNumber: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Table Name / Location (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Window Side, Rooftop"
                  value={addForm.tableName}
                  onChange={e => setAddForm(p => ({ ...p, tableName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  style={{ cursor: "pointer" }}
                  value={addForm.status}
                  onChange={e => setAddForm(p => ({ ...p, status: e.target.value as any }))}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>
              <div className="tables-modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={14} /> : "Save Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Generate Modal */}
      {showBulkModal && (
        <div className="tables-modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="tables-modal" onClick={e => e.stopPropagation()}>
            <div className="tables-modal-header">
              <span className="tables-modal-title">Bulk Generate Tables</span>
              <button className="tables-modal-close" onClick={() => setShowBulkModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleBulkGenerate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Prefix Label</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Table "
                  value={bulkForm.prefix}
                  onChange={e => setBulkForm(p => ({ ...p, prefix: e.target.value }))}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Start Number</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    required
                    value={bulkForm.start}
                    onChange={e => setBulkForm(p => ({ ...p, start: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Count (How many)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="form-input"
                    required
                    value={bulkForm.count}
                    onChange={e => setBulkForm(p => ({ ...p, count: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="tables-modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={14} /> : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {showEditModal && selectedTable && (
        <div className="tables-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="tables-modal" onClick={e => e.stopPropagation()}>
            <div className="tables-modal-header">
              <span className="tables-modal-title">Edit Table {selectedTable.tableNumber}</span>
              <button className="tables-modal-close" onClick={() => setShowEditModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditTable} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Table Number *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editForm.tableNumber}
                  onChange={e => setEditForm(p => ({ ...p, tableNumber: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Table Name / Location (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Window Side, Rooftop"
                  value={editForm.tableName}
                  onChange={e => setEditForm(p => ({ ...p, tableName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-input"
                  style={{ cursor: "pointer" }}
                  value={editForm.status}
                  onChange={e => setEditForm(p => ({ ...p, status: e.target.value as any }))}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>
              <div className="tables-modal-footer">
                <button type="button" className="btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" size={14} /> : "Update Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enlarged QR View Modal */}
      {enlargedQrTable && (
        <div className="tables-modal-overlay" onClick={() => setEnlargedQrTable(null)}>
          <div className="tables-modal" style={{ maxWidth: 400, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div className="tables-modal-header" style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: 10 }}>
              <span className="tables-modal-title" style={{ fontSize: "1.1rem" }}>Table {enlargedQrTable.tableNumber} QR Details</span>
              <button className="tables-modal-close" onClick={() => setEnlargedQrTable(null)}><X size={18} /></button>
            </div>

            <div style={{ padding: "10px 0" }}>
              <img
                src={enlargedQrTable.qrImageUrl}
                alt={`Table ${enlargedQrTable.tableNumber} QR`}
                style={{ width: 220, height: 220, margin: "0 auto", display: "block", border: "1.5px solid #ea580c", borderRadius: 12, padding: 10 }}
              />
              <p style={{ fontWeight: 700, margin: "14px 0 2px", color: "#111827", fontSize: "1.1rem" }}>
                Table {enlargedQrTable.tableNumber}
              </p>
              {enlargedQrTable.tableName && (
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>
                  {enlargedQrTable.tableName}
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, textAlign: "left", fontSize: "0.78rem", color: "#4b5563" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <Info size={14} style={{ color: "#ea580c", flexShrink: 0, marginTop: 1 }} />
                <span>Customers can scan this QR code with their mobile devices to access the menu page, place order, and check out directly.</span>
              </div>
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 8, overflowX: "auto" }}>
                <strong style={{ display: "block", marginBottom: 3 }}>Secure Table Link:</strong>
                <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", fontFamily: "monospace", fontSize: "0.74rem" }}>
                  {typeof window !== "undefined" ? `${window.location.origin}/menu?t=${enlargedQrTable.qrToken.substring(0, 15)}...` : ""}
                </code>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
              <button className="btn-outline" style={{ flex: 1, justifyContent: "center" }} onClick={() => printSingleQR(enlargedQrTable)}>
                <Printer size={14} /> Print
              </button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => downloadQR(enlargedQrTable)}>
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
