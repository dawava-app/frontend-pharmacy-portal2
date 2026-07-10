import { InventoryTransaction } from '../models/inventory.model';

export interface ReceiptMeta {
  branchName?: string;
  pharmacyName?: string;
  cashierName?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Builds one printable receipt block per transaction (thermal-receipt style,
 *  80mm width) and opens them all in a single print-ready window so the
 *  cashier can print one or several selected transactions at once. */
export function printReceipts(transactions: InventoryTransaction[], meta: ReceiptMeta = {}): void {
  if (transactions.length === 0) return;

  const branch = meta.branchName ? escapeHtml(meta.branchName) : '';
  const pharmacy = meta.pharmacyName ? escapeHtml(meta.pharmacyName) : 'Dawava Pharmacy';
  const cashier = meta.cashierName ? escapeHtml(meta.cashierName) : '';

  const receiptBlocks = transactions.map(tx => {
    const qtyLabel = tx.delta > 0 ? `+${tx.delta}` : `${tx.delta}`;
    const dateStr = new Date(tx.occurredAt).toLocaleString();
    return `
      <div class="receipt">
        <div class="receipt-logo">
          <div class="mark"></div>
          <div class="brand-text">
            <div class="brand-name">Dawava</div>
            <div class="brand-sub">${pharmacy}</div>
          </div>
        </div>
        ${branch ? `<div class="branch">${branch}</div>` : ''}
        <div class="divider"></div>
        <div class="row"><span>Receipt No.</span><span>${escapeHtml(tx.id.slice(0, 8).toUpperCase())}</span></div>
        <div class="row"><span>Date</span><span>${dateStr}</span></div>
        ${cashier ? `<div class="row"><span>Cashier</span><span>${cashier}</span></div>` : ''}
        <div class="row"><span>Source</span><span>${escapeHtml(tx.source)}</span></div>
        <div class="divider"></div>
        <div class="item">
          <div class="item-name">${escapeHtml(tx.medicineName)}</div>
          <div class="item-sub">${escapeHtml(tx.variantName)} · ${escapeHtml(tx.barcode || '—')}</div>
          <div class="row"><span>Qty change</span><span>${qtyLabel}</span></div>
          <div class="row"><span>Unit price</span><span>${tx.unitPrice.toFixed(2)} ${escapeHtml(tx.currencyCode)}</span></div>
        </div>
        <div class="divider"></div>
        <div class="row total"><span>Total</span><span>${tx.totalAmount.toFixed(2)} ${escapeHtml(tx.currencyCode)}</span></div>
        <div class="divider dashed"></div>
        <div class="footer">Thank you — Dawava Pharmacy System</div>
      </div>
    `;
  }).join('<div class="page-break"></div>');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Dawava Receipt</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; margin: 0; padding: 16px; background: #fff; color: #111; }
        .receipt { width: 300px; margin: 0 auto 24px; padding: 16px 0; }
        .receipt-logo { display: flex; align-items: center; gap: 10px; justify-content: center; margin-bottom: 6px; }
        .mark { width: 26px; height: 26px; background: #14b8a5; border-radius: 6px; position: relative; }
        .mark::before, .mark::after { content: ''; position: absolute; background: #fff; }
        .mark::before { left: 50%; top: 15%; bottom: 15%; width: 4px; transform: translateX(-50%); }
        .mark::after { top: 50%; left: 15%; right: 15%; height: 4px; transform: translateY(-50%); }
        .brand-text { text-align: left; }
        .brand-name { font-weight: 700; font-size: 15px; letter-spacing: 0.5px; }
        .brand-sub { font-size: 10px; color: #555; }
        .branch { text-align: center; font-size: 11px; color: #333; margin-bottom: 4px; }
        .divider { border-top: 1px solid #111; margin: 8px 0; }
        .divider.dashed { border-top: 1px dashed #111; }
        .row { display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0; }
        .row.total { font-weight: 700; font-size: 13px; margin-top: 4px; }
        .item-name { font-weight: 700; font-size: 12.5px; margin-top: 4px; }
        .item-sub { font-size: 10px; color: #555; margin-bottom: 4px; }
        .footer { text-align: center; font-size: 10px; color: #444; margin-top: 8px; }
        .page-break { page-break-after: always; }
        @media print {
          body { padding: 0; }
          .receipt { margin: 0 auto; }
        }
      </style>
    </head>
    <body>
      ${receiptBlocks}
      <script>
        window.onload = function () { window.focus(); window.print(); };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=420,height=640');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
