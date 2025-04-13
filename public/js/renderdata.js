// 載入並渲染資料
function loadAndRenderData(targetId) {
    fetch(`${apiUrl}/purchase`, {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        })
        .then(res => res.json())
        .then(data => {
            // 確保資料按照 serial_number 排序
            data.sort((a, b) => {
                if (a.serial_number < b.serial_number) return -1;
                if (a.serial_number > b.serial_number) return 1;
                return 0;
            });
            renderPurchaseData(data, targetId);
        });
}
// 渲染資料
function renderPurchaseData(data, targetId) {
    const list = document.getElementById(targetId);
    if (!list) return;
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    list.innerHTML = data.map(item => `
        <tr data-purchase-id="${item.id}">
            <td class="approve-only">
                ${item.status === '通過' ? 
                    `<input type="checkbox" onchange="togglePurchaseSelection(this)">` : 
                    ''}
            </td>
            <td>${item.serial_number || ''}</td>
            <td class="approve-only">
                ${item.purchase_date && new Date(item.purchase_date).getFullYear() !== 1970 
                ? new Date(item.purchase_date).toLocaleString("zh-TW", options): '未採購'}
            </td>
            <td class="invoice-only">
                ${(item.status === '通過' || item.status === '待審核') ? 
                    `<input type="date" class="purchase-date" value="${item.purchase_date ? formatDate(item.purchase_date) : ''}">` : 
                    `<span>${item.actual_price || ''}</span>`
                }
            </td>
            <td>${new Date(item.created_at).toLocaleString("zh-TW", options)}</td>
            <td>${item.username}</td>
            <td>${item.team}</td>
            <td>${item.purchase_desc}</td>
            <td>${item.system_type || ''}</td>
            <td>${item.use}</td>
            <td>${item.amount}</td>
            <td>${item.total_cost}</td>
            <td>${item.purchase_import}</td>
            <td>${item.purchase_note}</td>
            <td class="purchase-only">${item.status}</td>
            <td class="invoice-only">${item.status}</td>
            <td class="approve-only" data-id="${item.id}">
                <select onchange="updateApprovalStatus(this)">
                    <option value="待審核" ${item.status === '待審核' ? 'selected' : ''}>待審核</option>
                    <option value="通過" ${item.status === '通過' ? 'selected' : ''}>通過</option>
                    <option value="未通過" ${item.status === '未通過' ? 'selected' : ''}>未通過</option>
                </select>
            </td>
            <td class="invoice-only"><input type="number" class="actual-price" placeholder="${item.actual_price || ''}"></td>
            <td class="invoice-only">
                ${(item.status === '通過') ? 
                    `<div class="invoice-upload-container">
                        <input type="file" class="invoice-file" multiple accept="image/*" 
                            data-serial="${item.serial_number}" onchange="handleFileUpload(this)">
                        <div class="preview-container">
                            ${item.invoice_files && item.invoice_files.length > 0 ? 
                                item.invoice_files.map(file => `
                                    <div class="image-wrapper">
                                        <img src="/uploads/${item.serial_number}/${file}" 
                                             alt="發票照片" 
                                             onclick="showFullImage(this.src)"
                                             style="max-width: 100px; margin: 5px; cursor: pointer;">
                                        <button class="delete-image-btn" 
                                                onclick="deleteInvoiceImage('${item.serial_number}', '${file}', this)">
                                            ×
                                        </button>
                                    </div>
                                `).join('') : 
                                ''
                            }
                        </div>
                    </div>` : 
                    `<span>無法上傳（審核未通過）</span>`
                }
            </td>
            <td class="approve-only">
                ${item.invoice_files && item.invoice_files.length > 0 ? 
                    `<div class="invoice-images">
                        ${item.invoice_files.map(file => `
                            <img src="/uploads/${item.serial_number}/${file}" 
                                 alt="發票照片" 
                                 onclick="showFullImage(this.src)"
                                 style="max-width: 100px; margin: 5px; cursor: pointer;">
                        `).join('')}
                    </div>` : 
                    '尚未上傳發票'
                }
            </td>
            <td class="approve-only">${item.actual_price || ''}</td>
            <td class="approve-only">${item.school_reimbursement_id || ''}</td>
            <td class="approve-only">
                <select onchange="updateReimbursementStatus(this, ${item.id})">
                    <option value="0" ${(!item.invoice_files || item.invoice_files.length === 0) ? 'selected' : ''}>無發票</option>
                    <option value="1" ${(item.invoice_files && item.invoice_files.length > 0 && (!item.school_reimbursement_status || item.school_reimbursement_status === '1')) ? 'selected' : ''}>未送出</option>
                    <option value="2" ${item.school_reimbursement_status === '2' ? 'selected' : ''}>已送出</option>
                    <option value="3" ${item.school_reimbursement_status === '3' ? 'selected' : ''}>學校匯款</option>
                    <option value="4" ${item.school_reimbursement_status === '4' ? 'selected' : ''}>已還款</option>
                </select>
            </td>
            <td class="invoice-only"><button onclick="updateInvoiceData(this)">更新資料</button></td>
            <td class="purchase-only">
                ${item.status === '待審核' && item.username === localStorage.getItem("username") ? 
                    `<button class="delete-btn" onclick="deletePurchase(${item.id})">刪除</button>` : 
                    ''}
            </td>
            
        </tr>
    `).join('');

    // 控制顯示邏輯
    const displayMap = {
        "purchase-list-purchase": "purchase-only",
        "purchase-list-invoice": "invoice-only",
        "purchase-list-approve": "approve-only"
    };

    Object.values(displayMap).forEach(className => {
        document.querySelectorAll(`.${className}`).forEach(el => {
            el.style.display = "none";
        });
    });

    const showClass = displayMap[targetId];
    if (showClass) {
        document.querySelectorAll(`.${showClass}`).forEach(el => {
            el.style.display = "";
        });
    }
}