(() => {
  "use strict";
  const STORE_KEY = "business-stock-manager-v1";
  const $ = (id) => document.getElementById(id);
  const money = (n) => new Intl.NumberFormat("en-PK", {style:"currency", currency:"PKR", maximumFractionDigits:2}).format(Number(n)||0);
  const num = (n) => new Intl.NumberFormat("en-PK", {maximumFractionDigits:2}).format(Number(n)||0);
  const dateText = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}); };
  const today = () => new Date().toISOString();
  const escapeHTML = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));
  const blankState = () => ({products:[],transactions:[]});
  let state = loadState(), currentPage = "dashboard", searchTerm = "";
  function loadState() {
    try { const parsed = JSON.parse(localStorage.getItem(STORE_KEY)); if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.transactions)) return parsed; }
    catch (e) { console.warn("Could not load saved data", e); }
    return blankState();
  }
  function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600); }
  function setPage(page) {
    currentPage=page; searchTerm="";
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    const titles={dashboard:"Dashboard",products:"Products",sales:"Sales",purchases:"Purchases",reports:"Reports"};
    $("page-title").textContent=titles[page]||"Dashboard";
    $("quick-add").style.display=page==="products"?"none":"inline-block";
    render();
  }
  function stats() {
    const todayKey = new Date().toDateString();
    const sales = state.transactions.filter(t=>t.type==="sale");
    const purchases = state.transactions.filter(t=>t.type==="purchase");
    const todaySales=sales.filter(t=>new Date(t.date).toDateString()===todayKey);
    const todayProfit=todaySales.reduce((s,t)=>s+(t.unitPrice-t.unitCost)*t.qty,0);
    return {
      productCount:state.products.length,
      stockUnits:state.products.reduce((s,p)=>s+p.qty,0),
      stockValue:state.products.reduce((s,p)=>s+p.cost*p.qty,0),
      todaySales:todaySales.reduce((s,t)=>s+t.unitPrice*t.qty,0),
      todayProfit,
      totalSales:sales.reduce((s,t)=>s+t.unitPrice*t.qty,0),
      totalPurchases:purchases.reduce((s,t)=>s+t.unitPrice*t.qty,0),
      totalProfit:sales.reduce((s,t)=>s+(t.unitPrice-t.unitCost)*t.qty,0),
      low:state.products.filter(p=>p.qty<=p.low)
    };
  }
  function empty(message, detail="Add your first record to get started.") { return `<div class="empty"><strong>${escapeHTML(message)}</strong>${escapeHTML(detail)}</div>`; }
  function table(rows, headers, emptyMessage="No records yet") {
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||""}</tbody></table>${rows?"":empty(emptyMessage)}</div>`;
  }
  function productRows(products) {
    return products.map(p=>`<tr><td><div class="product-cell">${escapeHTML(p.name)}</div><div class="secondary-cell">${escapeHTML(p.sku||p.category||"No code")}</div></td><td>${escapeHTML(p.category||"—")}</td><td class="money">${money(p.cost)}</td><td class="money">${money(p.price)}</td><td>${num(p.qty)}</td><td>${p.qty===0?'<span class="pill out">Out of stock</span>':p.qty<=p.low?'<span class="pill low">Low stock</span>':'<span class="pill">In stock</span>'}</td><td><button class="small-btn" data-edit="${p.id}">Edit</button> <button class="small-btn" data-delete="${p.id}">Delete</button></td></tr>`).join("");
  }
  function transactionRows(type, limit=100) {
    return state.transactions.filter(t=>t.type===type).slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,limit).map(t=>`<tr><td>${dateText(t.date)}</td><td><div class="product-cell">${escapeHTML(t.productName)}</div><div class="secondary-cell">${escapeHTML(t.note||"")}</div></td><td>${num(t.qty)}</td><td class="money">${money(t.unitPrice)}</td><td class="money">${money(t.unitPrice*t.qty)}</td>${type==="sale"?`<td class="money" style="color:var(--teal)">${money((t.unitPrice-t.unitCost)*t.qty)}</td>`:""}</tr>`).join("");
  }
  function renderDashboard() {
    const s=stats();
    $("page-content").innerHTML=`
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-top">Total products <span class="stat-icon">▣</span></div><div class="stat-value">${num(s.productCount)}</div><div class="stat-foot">${num(s.stockUnits)} units in stock</div></div>
        <div class="stat-card"><div class="stat-top">Stock value <span class="stat-icon">◇</span></div><div class="stat-value">${money(s.stockValue)}</div><div class="stat-foot">At purchase cost</div></div>
        <div class="stat-card"><div class="stat-top">Today's sales <span class="stat-icon">↗</span></div><div class="stat-value">${money(s.todaySales)}</div><div class="stat-foot">Sales recorded today</div></div>
        <div class="stat-card"><div class="stat-top">Today's gross profit <span class="stat-icon">⌁</span></div><div class="stat-value">${money(s.todayProfit)}</div><div class="stat-foot">Before expenses</div></div>
      </div>
      <div class="content-grid">
        <div>
          <section class="panel"><div class="panel-head"><h2>Recent sales</h2><button class="btn btn-light" data-go="sales">View all</button></div>${table(transactionRows("sale",5),["Date","Product / note","Qty","Unit price","Total","Gross profit"],"No sales yet","Record a sale to see it here.")}</section>
          <section class="panel"><div class="panel-head"><h2>Inventory snapshot</h2><button class="btn btn-light" data-go="products">Manage products</button></div>${table(productRows(state.products.slice(0,5)),["Product","Category","Cost","Sale price","Qty","Status","Actions"],"No products yet","Add products to start tracking inventory.")}</section>
        </div>
        <div>
          <section class="panel"><div class="panel-head"><h2>Quick actions</h2></div><div class="quick-actions">
            <button class="quick-action" data-action="add-product"><span>＋</span><strong>Add product</strong><small>Create inventory item</small></button>
            <button class="quick-action" data-action="sale"><span>↗</span><strong>Record sale</strong><small>Reduce stock quantity</small></button>
            <button class="quick-action" data-action="purchase"><span>↙</span><strong>Record purchase</strong><small>Increase stock quantity</small></button>
            <button class="quick-action" data-action="backup"><span>⇩</span><strong>Backup data</strong><small>Save a JSON copy</small></button>
          </div></section>
          <section class="panel"><div class="panel-head"><h2>Low-stock alerts</h2><span class="pill ${s.low.length?'low':''}">${s.low.length} items</span></div>
          ${s.low.length?s.low.slice(0,8).map(p=>`<div class="alert-row"><div class="alert-symbol">!</div><div class="alert-name">${escapeHTML(p.name)}<div class="secondary-cell">Alert at ${num(p.low)} units</div></div><div class="alert-qty">${num(p.qty)} left</div></div>`).join(""):empty("Stock levels look good","Items at or below their alert level appear here.")}</section>
          <section class="panel"><div class="panel-head"><h2>Getting started</h2></div><p class="help-text">1. Add your products and opening quantities.<br>2. Record purchases whenever new stock arrives.<br>3. Record sales as they happen.<br>4. Export a backup regularly from Reports.</p><div class="danger-note">Data is saved in this browser on this device. It does not automatically sync to another phone or computer.</div></section>
        </div>
      </div>`;
  }
  function renderProducts() {
    const list=state.products.filter(p=>(p.name+" "+p.sku+" "+p.category).toLowerCase().includes(searchTerm.toLowerCase()));
    $("page-content").innerHTML=`<section class="panel"><div class="toolbar"><div class="toolbar-left"><input class="search" id="product-search" placeholder="Search products..." value="${escapeHTML(searchTerm)}"></div><div class="toolbar-right"><button class="btn btn-outline" data-action="export-products">Export CSV</button><button class="btn btn-primary" data-action="add-product">＋ Add product</button></div></div>
      ${table(productRows(list),["Product","Category","Cost","Sale price","Qty","Status","Actions"],"No products found","Add a product or try another search.")}</section>`;
    $("product-search").addEventListener("input",e=>{searchTerm=e.target.value; const pos=e.target.selectionStart; renderProducts(); const el=$("product-search");el.focus();el.setSelectionRange(pos,pos);});
  }
  function renderSales() {
    $("page-content").innerHTML=`<section class="panel"><div class="toolbar"><div><h2>Sales history</h2><div class="subtle">Gross profit = sale price minus purchase cost, multiplied by quantity.</div></div><div class="toolbar-right"><button class="btn btn-outline" data-action="export-sales">Export CSV</button><button class="btn btn-primary" data-action="sale">＋ Record sale</button></div></div>${table(transactionRows("sale"),["Date","Product / note","Qty","Unit price","Total","Gross profit"],"No sales recorded","Use Record sale when a customer buys items.")}</section>`;
  }
  function renderPurchases() {
    $("page-content").innerHTML=`<section class="panel"><div class="toolbar"><div><h2>Purchase history</h2><div class="subtle">Purchases add quantities to your available stock.</div></div><div class="toolbar-right"><button class="btn btn-outline" data-action="export-purchases">Export CSV</button><button class="btn btn-primary" data-action="purchase">＋ Record purchase</button></div></div>${table(transactionRows("purchase"),["Date","Product / supplier","Qty","Unit cost","Total"],"No purchases recorded","Record a purchase when new stock arrives.")}</section>`;
  }
  function renderReports() {
    const s=stats();
    $("page-content").innerHTML=`<section class="panel"><div class="panel-head"><div><h2>Business summary</h2><div class="subtle">All recorded transactions</div></div><div class="report-actions"><button class="btn btn-outline" data-action="backup">⇩ Download backup</button><button class="btn btn-outline" data-action="restore">⇧ Restore backup</button></div></div>
      <div class="report-cards">
        <div class="report-card"><span>Total sales</span><strong>${money(s.totalSales)}</strong></div>
        <div class="report-card"><span>Total purchases recorded</span><strong>${money(s.totalPurchases)}</strong></div>
        <div class="report-card"><span>Gross profit on recorded sales</span><strong>${money(s.totalProfit)}</strong></div>
        <div class="report-card"><span>Current stock at cost</span><strong>${money(s.stockValue)}</strong></div>
        <div class="report-card"><span>Products tracked</span><strong>${num(s.productCount)}</strong></div>
        <div class="report-card"><span>Low-stock items</span><strong>${num(s.low.length)}</strong></div>
      </div>
      <p class="help-text">Gross profit is an estimate based on each product's current saved purchase cost at the time of each sale. It does not include rent, fuel, salaries, discounts, tax, customer credit, or other expenses.</p>
    </section>
    <section class="panel"><div class="panel-head"><h2>Data & safety</h2></div><p class="help-text">Your data is stored locally in this browser using local storage. Clearing browser data may remove it. Download a JSON backup regularly and keep it somewhere safe. Restore replaces the current records with the selected backup.</p><div class="report-actions"><button class="btn btn-outline" data-action="backup">Download backup</button><button class="btn btn-outline" data-action="restore">Restore backup</button><button class="btn btn-outline" data-action="export-products">Export products CSV</button><button class="btn btn-outline" data-action="export-sales">Export sales CSV</button></div></section>`;
  }
  function render() {
    if(currentPage==="dashboard")renderDashboard();
    else if(currentPage==="products")renderProducts();
    else if(currentPage==="sales")renderSales();
    else if(currentPage==="purchases")renderPurchases();
    else renderReports();
  }
  function openProduct(product=null) {
    $("product-form").reset(); $("product-id").value=product?.id||"";
    $("product-dialog-title").textContent=product?"Edit product":"Add product";
    $("product-name").value=product?.name||""; $("product-sku").value=product?.sku||""; $("product-category").value=product?.category||"";
    $("product-cost").value=product?.cost??0; $("product-price").value=product?.price??0; $("product-qty").value=product?.qty??0; $("product-low").value=product?.low??5;
    $("product-qty").disabled=!!product;
    $("product-dialog").showModal();
  }
  function openTransaction(type) {
    if(!state.products.length){toast("Please add a product first.");openProduct();return;}
    $("transaction-form").reset(); $("transaction-type").value=type;
    $("transaction-title").textContent=type==="sale"?"Record sale":"Record purchase";
    $("transaction-eyebrow").textContent=type==="sale"?"SALES":"PURCHASES";
    $("transaction-price-label").firstChild.textContent=type==="sale"?"Unit sale price (PKR)":"Unit purchase cost (PKR)";
    $("transaction-product").innerHTML=state.products.map(p=>`<option value="${p.id}">${escapeHTML(p.name)} — ${num(p.qty)} in stock</option>`).join("");
    updateTransactionPrice(); $("transaction-dialog").showModal();
  }
  function selectedProduct() { return state.products.find(p=>p.id===$("transaction-product").value); }
  function updateTransactionPrice() {
    const p=selectedProduct(), type=$("transaction-type").value;
    $("transaction-price").value=p?(type==="sale"?p.price:p.cost):0;
    updateTransactionTotal();
  }
  function updateTransactionTotal() { $("transaction-total").textContent=money((Number($("transaction-qty").value)||0)*(Number($("transaction-price").value)||0)); }
  function download(filename, content, type="text/plain;charset=utf-8") {
    const blob=new Blob([content],{type}), url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  function csvCell(value) { const s=String(value??""); return `"${s.replace(/"/g,'""')}"`; }
  function exportCSV(kind) {
    let rows, filename;
    if(kind==="products") { rows=[["Name","SKU","Category","Purchase cost PKR","Sale price PKR","Quantity","Low stock level"],...state.products.map(p=>[p.name,p.sku,p.category,p.cost,p.price,p.qty,p.low])];filename="business-stock-products.csv"; }
    else { const type=kind==="sales"?"sale":"purchase";rows=[["Date","Type","Product","Quantity","Unit price PKR","Unit cost PKR","Total PKR","Gross profit PKR","Note"],...state.transactions.filter(t=>t.type===type).map(t=>[t.date,t.type,t.productName,t.qty,t.unitPrice,t.unitCost,t.qty*t.unitPrice,t.type==="sale"?(t.unitPrice-t.unitCost)*t.qty:0,t.note])];filename=`business-stock-${kind}.csv`; }
    download(filename,"\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n"),"text/csv;charset=utf-8");toast("CSV exported.");
  }
  function backup() { download("business-stock-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({app:"Business Stock Manager",version:1,exportedAt:today(),...state},null,2),"application/json");toast("Backup downloaded."); }
  function restore(file) {
    const reader=new FileReader();
    reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.products)||!Array.isArray(data.transactions))throw new Error("Invalid backup");if(!confirm("Restore will replace the current records on this device. Continue?"))return;state={products:data.products,transactions:data.transactions};saveState();render();toast("Backup restored.");}catch(e){alert("This backup file is not valid for Business Stock Manager.");}};
    reader.readAsText(file);
  }
  document.addEventListener("click",e=>{
    const nav=e.target.closest("[data-page]"); if(nav){setPage(nav.dataset.page);return;}
    const go=e.target.closest("[data-go]");if(go){setPage(go.dataset.go);return;}
    const close=e.target.closest("[data-close]");if(close){$(close.dataset.close).close();return;}
    const edit=e.target.closest("[data-edit]");if(edit){const p=state.products.find(p=>p.id===edit.dataset.edit);if(p)openProduct(p);return;}
    const del=e.target.closest("[data-delete]");if(del){const p=state.products.find(p=>p.id===del.dataset.delete);if(p&&confirm(`Delete ${p.name}? Historical transactions will remain in reports.`)){state.products=state.products.filter(x=>x.id!==p.id);saveState();render();toast("Product deleted.");}return;}
    const action=e.target.closest("[data-action]")?.dataset.action;if(!action)return;
    if(action==="add-product")openProduct();
    else if(action==="sale"||action==="purchase")openTransaction(action);
    else if(action==="backup")backup();
    else if(action==="restore")$("restore-file").click();
    else if(action==="export-products")exportCSV("products");
    else if(action==="export-sales")exportCSV("sales");
    else if(action==="export-purchases")exportCSV("purchases");
  });
  $("quick-add").addEventListener("click",()=>openProduct());
  $("product-form").addEventListener("submit",e=>{
    e.preventDefault();
    const id=$("product-id").value, name=$("product-name").value.trim();
    if(!name){toast("Enter a product name.");return;}
    const record={id:id||uid(),name,sku:$("product-sku").value.trim(),category:$("product-category").value.trim(),cost:Number($("product-cost").value),price:Number($("product-price").value),qty:Number($("product-qty").value),low:Number($("product-low").value)};
    if(![record.cost,record.price,record.qty,record.low].every(n=>Number.isFinite(n)&&n>=0)){toast("Please enter valid non-negative numbers.");return;}
    if(id){const index=state.products.findIndex(p=>p.id===id);if(index>=0)state.products[index]={...state.products[index],...record,qty:state.products[index].qty};}
    else state.products.push(record);
    saveState();$("product-dialog").close();render();toast(id?"Product updated.":"Product added.");
  });
  $("transaction-product").addEventListener("change",updateTransactionPrice);
  $("transaction-qty").addEventListener("input",updateTransactionTotal);
  $("transaction-price").addEventListener("input",updateTransactionTotal);
  $("transaction-form").addEventListener("submit",e=>{
    e.preventDefault();
    const type=$("transaction-type").value,p=selectedProduct(),qty=Number($("transaction-qty").value),price=Number($("transaction-price").value);
    if(!p||!Number.isInteger(qty)||qty<1||!Number.isFinite(price)||price<0){toast("Check product, quantity and price.");return;}
    if(type==="sale"&&qty>p.qty){toast(`Only ${p.qty} units available.`);return;}
    if(type==="sale")p.qty-=qty;else {p.qty+=qty;p.cost=price;}
    state.transactions.push({id:uid(),type,productId:p.id,productName:p.name,qty,unitPrice:price,unitCost:type==="sale"?p.cost:price,note:$("transaction-note").value.trim(),date:today()});
    saveState();$("transaction-dialog").close();render();toast(type==="sale"?"Sale recorded and stock updated.":"Purchase recorded and stock updated.");
  });
  $("restore-file").addEventListener("change",e=>{const f=e.target.files?.[0];if(f)restore(f);e.target.value="";});
  $("today-label").textContent=new Date().toLocaleDateString("en-PK",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page)));
  render(