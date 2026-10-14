"use strict";

const STORAGE_KEY = "businessStockManager_v1";

const state = {
  products: [],
  transactions: [],
  page: "dashboard"
};

const $ = (s) => document.querySelector(s);
const num = (v) => Number(v) || 0;

function money(v) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2
  }).format(num(v));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2500);
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      products: state.products,
      transactions: state.transactions
    }));
  } catch {
    toast("Data save nahi ho saka. Backup download karein.");
  }
}

function loadData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.products = Array.isArray(data.products) ? data.products : [];
    state.transactions = Array.isArray(data.transactions) ? data.transactions : [];
  } catch {
    state.products = [];
    state.transactions = [];
  }
}

function getProduct(id) {
  return state.products.find(p => p.id === id);
}

function stockValue() {
  return state.products.reduce((s, p) => s + num(p.qty) * num(p.cost), 0);
}

function txTotal(t) {
  return num(t.qty) * num(t.price);
}

function todayTx(type) {
  const today = new Date().toISOString().slice(0, 10);
  return state.transactions.filter(t =>
    t.type === type && t.date.slice(0, 10) === today
  );
}

function initApp() {
  loadData();

  const date = $("#today-label");
  if (date) {
    date.textContent = new Date().toLocaleDateString("en-PK", {
      day: "numeric", month: "short", year: "numeric"
    });
  }

  $("#navigation")?.addEventListener("click", e => {
    const b = e.target.closest("[data-page]");
    if (b) navigate(b.dataset.page);
  });

  $("#quick-add")?.addEventListener("click", () => openProduct());
  $("#product-form")?.addEventListener("submit", saveProduct);
  $("#transaction-form")?.addEventListener("submit", saveTransaction);
  $("#transaction-product")?.addEventListener("change", updatePrice);
  $("#transaction-qty")?.addEventListener("input", updateTotal);
  $("#transaction-price")?.addEventListener("input", updateTotal);
  $("#restore-file")?.addEventListener("change", restoreBackup);

  document.addEventListener("click", e => {
    const close = e.target.closest("[data-close]");
    if (close) {
      closeDialog(close.dataset.close);
      return;
    }

    const page = e.target.closest("[data-page]");
    if (page && !$("#navigation")?.contains(page)) {
      navigate(page.dataset.page);
      return;
    }

    const b = e.target.closest("[data-action]");
    if (!b) return;

    const id = b.dataset.id;
    switch (b.dataset.action) {
      case "add-product": openProduct(); break;
      case "edit-product": openProduct(id); break;
      case "delete-product": deleteProduct(id); break;
      case "record-sale": openTransaction("sale"); break;
      case "record-purchase": openTransaction("purchase"); break;
      case "export": exportBackup(); break;
      case "restore": $("#restore-file")?.click(); break;
      case "delete-transaction": deleteTransaction(id); break;
    }
  });

  navigate("dashboard");
}

function navigate(page) {
  const allowed = ["dashboard", "products", "sales", "purchases", "reports"];
  if (!allowed.includes(page)) return;

  state.page = page;

  document.querySelectorAll("#navigation [data-page]").forEach(b => {
    const active = b.dataset.page === page;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });

  const titles = {
    dashboard: "Dashboard",
    products: "Products",
    sales: "Sales",
    purchases: "Purchases",
    reports: "Reports"
  };

  $("#page-title").textContent = titles[page];
  renderPage();
}

function renderPage() {
  const el = $("#page-content");
  if (!el) return;

  const pages = {
    dashboard: renderDashboard,
    products: renderProducts,
    sales: () => renderTransactions("sale"),
    purchases: () => renderTransactions("purchase"),
    reports: renderReports
  };

  el.innerHTML = pages[state.page]();
}

function renderDashboard() {
  const sales = todayTx("sale").reduce((s, t) => s + txTotal(t), 0);
  const purchases = todayTx("purchase").reduce((s, t) => s + txTotal(t), 0);
  const low = state.products.filter(p => num(p.qty) <= num(p.low));
  const recent = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return `
    <div class="stats-grid">
      <article class="stat-card"><span>Total products</span><strong>${state.products.length}</strong></article>
      <article class="stat-card"><span>Stock value</span><strong>${money(stockValue())}</strong></article>
      <article class="stat-card"><span>Today's sales</span><strong>${money(sales)}</strong></article>
      <article class="stat-card"><span>Today's purchases</span><strong>${money(purchases)}</strong></article>
    </div>

    <div class="section-heading"><div><h2>Quick actions</h2><p>Manage inventory and transactions.</p></div></div>
    <div class="quick-actions">
      <button class="btn btn-primary" data-action="add-product">＋ Add product</button>
      <button class="btn btn-light" data-action="record-sale">Record sale</button>
      <button class="btn btn-light" data-action="record-purchase">Record purchase</button>
      <button class="btn btn-light" data-action="export">Backup data</button>
    </div>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-heading"><div><h2>Low stock alerts</h2><p>Products needing restock.</p></div>
          <button class="btn btn-light btn-small" data-page="products">View products</button>
        </div>
        ${low.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Product</th><th>Stock</th><th>Alert at</th></tr></thead>
          <tbody>${low.map(p => `<tr><td>${esc(p.name)}</td><td>${num(p.qty)}</td><td>${num(p.low)}</td></tr>`).join("")}</tbody>
        </table></div>` : `<div class="empty-state">No low-stock products.</div>`}
      </section>

      <section class="panel">
        <div class="panel-heading"><div><h2>Recent activity</h2><p>Latest transactions.</p></div></div>
        ${recent.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Type</th><th>Product</th><th>Total</th></tr></thead>
          <tbody>${recent.map(t => `<tr><td>${t.type}</td><td>${esc(t.productName)}</td><td>${money(txTotal(t))}</td></tr>`).join("")}</tbody>
        </table></div>` : `<div class="empty-state">No transactions yet.</div>`}
      </section>
    </div>`;
}

function renderProducts() {
  return `
    <div class="section-heading"><div><h2>Products</h2><p>Manage your inventory.</p></div>
      <button class="btn btn-primary" data-action="add-product">＋ Add product</button>
    </div>
    <section class="panel"><div class="table-wrap"><table>
      <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Cost</th><th>Sale price</th><th>Stock</th><th>Value</th><th>Actions</th></tr></thead>
      <tbody>
      ${state.products.length ? state.products.map(p => `<tr>
        <td>${esc(p.name)}</td><td>${esc(p.sku || "—")}</td><td>${esc(p.category || "—")}</td>
        <td>${money(p.cost)}</td><td>${money(p.price)}</td><td>${num(p.qty)}</td>
        <td>${money(num(p.qty) * num(p.cost))}</td>
        <td><div class="table-actions">
          <button class="btn btn-light btn-small" data-action="edit-product" data-id="${esc(p.id)}">Edit</button>
          <button class="btn btn-light btn-small" data-action="delete-product" data-id="${esc(p.id)}">Delete</button>
        </div></td>
      </tr>`).join("") : `<tr><td colspan="8"><div class="empty-state">No products. Add your first product.</div></td></tr>`}
      </tbody>
    </table></div></section>`;
}

function renderTransactions(type) {
  const sale = type === "sale";
  const list = state.transactions.filter(t => t.type === type)
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, t) => s + txTotal(t), 0);

  return `
    <div class="section-heading"><div><h2>${sale ? "Sales history" : "Purchase history"}</h2>
      <p>${list.length} transactions · ${money(total)}</p></div>
      <button class="btn btn-primary" data-action="${sale ? "record-sale" : "record-purchase"}">＋ Record ${sale ? "sale" : "purchase"}</button>
    </div>
    <section class="panel"><div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th><th>Customer / Supplier</th><th>Action</th></tr></thead>
      <tbody>
      ${list.length ? list.map(t => `<tr>
        <td>${esc(new Date(t.date).toLocaleString())}</td><td>${esc(t.productName)}</td>
        <td>${num(t.qty)}</td><td>${money(t.price)}</td><td>${money(txTotal(t))}</td>
        <td>${esc(t.note || "—")}</td>
        <td><button class="btn btn-light btn-small" data-action="delete-transaction" data-id="${esc(t.id)}">Delete</button></td>
      </tr>`).join("") : `<tr><td colspan="7"><div class="empty-state">No transactions yet.</div></td></tr>`}
      </tbody>
    </table></div></section>`;
}

function renderReports() {
  const sales = state.transactions.filter(t => t.type === "sale");
  const purchases = state.transactions.filter(t => t.type === "purchase");
  const saleTotal = sales.reduce((s, t) => s + txTotal(t), 0);
  const purchaseTotal = purchases.reduce((s, t) => s + txTotal(t), 0);
  const profit = sales.reduce((s, t) => s + (num(t.price) - num(t.costAtTime)) * num(t.qty), 0);

  return `
    <div class="stats-grid">
      <article class="stat-card"><span>Total sales</span><strong>${money(saleTotal)}</strong></article>
      <article class="stat-card"><span>Total purchases</span><strong>${money(purchaseTotal)}</strong></article>
      <article class="stat-card"><span>Estimated gross profit</span><strong>${money(profit)}</strong></article>
      <article class="stat-card"><span>Current stock value</span><strong>${money(stockValue())}</strong></article>
    </div>
    <section class="panel report-panel">
      <div class="panel-heading"><div><h2>Data management</h2><p>Backup or restore inventory data.</p></div></div>
      <div class="quick-actions">
        <button class="btn btn-primary" data-action="export">Export backup</button>
        <button class="btn btn-light" data-action="restore">Restore backup</button>
      </div>
      <p class="helper-text">Data is saved in this browser on this device. Keep backups regularly.</p>
    </section>`;
    }

function openProduct(id = "") {
  const form = $("#product-form");
  const p = id ? getProduct(id) : null;
  form.reset();

  $("#product-id").value = p?.id || "";
  $("#product-dialog-title").textContent = p ? "Edit product" : "Add product";
  $("#product-name").value = p?.name || "";
  $("#product-sku").value = p?.sku || "";
  $("#product-category").value = p?.category || "";
  $("#product-cost").value = p?.cost ?? 0;
  $("#product-price").value = p?.price ?? 0;
  $("#product-qty").value = p?.qty ?? 0;
  $("#product-low").value = p?.low ?? 5;

  openDialog("product-dialog");
}

function saveProduct(e) {
  e.preventDefault();
  const id = $("#product-id").value;
  const old = id ? getProduct(id) : null;
  const p = {
    id: id || makeId(),
    name: $("#product-name").value.trim(),
    sku: $("#product-sku").value.trim(),
    category: $("#product-category").value.trim(),
    cost: num($("#product-cost").value),
    price: num($("#product-price").value),
    qty: Math.floor(num($("#product-qty").value)),
    low: Math.floor(num($("#product-low").value))
  };

  if (!p.name) return toast("Enter product name.");
  if ([p.cost, p.price, p.qty, p.low].some(v => v < 0)) return toast("Values cannot be negative.");

  if (old) {
    Object.assign(old, p);
    toast("Product updated.");
  } else {
    state.products.push(p);
    toast("Product added.");
  }

  saveData();
  closeDialog("product-dialog");
  renderPage();
}

function deleteProduct(id) {
  const p = getProduct(id);
  if (!p || !confirm(`Delete ${p.name}?`)) return;
  state.products = state.products.filter(x => x.id !== id);
  saveData();
  renderPage();
  toast("Product deleted.");
}

function openTransaction(type) {
  if (!state.products.length) {
    toast("Please add a product first.");
    navigate("products");
    return;
  }

  $("#transaction-form").reset();
  $("#transaction-type").value = type;
  $("#transaction-title").textContent = type === "sale" ? "Record sale" : "Record purchase";
  $("#transaction-eyebrow").textContent = type === "sale" ? "SALES" : "PURCHASES";
  $("#transaction-product").innerHTML = state.products.map(p =>
    `<option value="${esc(p.id)}">${esc(p.name)} — Stock: ${num(p.qty)}</option>`
  ).join("");

  $("#transaction-qty").value = 1;
  updatePrice();
  openDialog("transaction-dialog");
}

function updatePrice() {
  const p = getProduct($("#transaction-product").value);
  if (!p) return;
  $("#transaction-price").value = $("#transaction-type").value === "sale" ? p.price : p.cost;
  updateTotal();
}

function updateTotal() {
  $("#transaction-total").textContent = money(num($("#transaction-qty").value) * num($("#transaction-price").value));
}

function saveTransaction(e) {
  e.preventDefault();
  const type = $("#transaction-type").value;
  const p = getProduct($("#transaction-product").value);
  const qty = Math.floor(num($("#transaction-qty").value));
  const price = num($("#transaction-price").value);

  if (!p) return toast("Select a product.");
  if (qty < 1 || price < 0) return toast("Enter valid quantity and price.");
  if (type === "sale" && qty > num(p.qty)) return toast(`Only ${num(p.qty)} in stock.`);

  p.qty = type === "sale" ? num(p.qty) - qty : num(p.qty) + qty;

  state.transactions.push({
    id: makeId(),
    type,
    productId: p.id,
    productName: p.name,
    qty,
    price,
    costAtTime: num(p.cost),
    note: $("#transaction-note").value.trim(),
    date: new Date().toISOString()
  });

  saveData();
  closeDialog("transaction-dialog");
  renderPage();
  toast(type === "sale" ? "Sale saved." : "Purchase saved.");
}

function deleteTransaction(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t || !confirm("Delete transaction and reverse stock change?")) return;

  const p = getProduct(t.productId);
  if (p) {
    p.qty = t.type === "sale"
      ? num(p.qty) + num(t.qty)
      : Math.max(0, num(p.qty) - num(t.qty));
  }

  state.transactions = state.transactions.filter(x => x.id !== id);
  saveData();
  renderPage();
  toast("Transaction deleted.");
}

function openDialog(id) {
  const d = document.getElementById(id);
  if (!d) return;
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", "");
}

function closeDialog(id) {
  const d = document.getElementById(id);
  if (!d) return;
  if (typeof d.close === "function" && d.open) d.close();
  else d.removeAttribute("open");
}

function exportBackup() {
  const data = {
    app: "Business Stock Manager",
    version: 1,
    exportedAt: new Date().toISOString(),
    products: state.products,
    transactions: state.transactions
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "business-stock-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup download started.");
}

function restoreBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data.products) || !Array.isArray(data.transactions)) {
        throw new Error("Invalid backup");
      }
      if (!confirm("Restore backup and replace current data?")) return;

      state.products = data.products;
      state.transactions = data.transactions;
      saveData();
      renderPage();
      toast("Backup restored.");
    } catch {
      toast("Invalid backup file.");
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", initApp);
    
