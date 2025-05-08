// 載入資料
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
            <td class="approve-only" data-id="${item.serial_number}">
                <select onchange="updateApprovalStatus(this, ${item.serial_number})" >   
                    <option value="待審核" ${item.status === '待審核' ? 'selected' : ''}>待審核</option>
                    <option value="通過" ${item.status === '通過' ? 'selected' : ''}>通過</option>
                    <option value="未通過" ${item.status === '未通過' ? 'selected' : ''}>未通過</option>
                </select>
            </td>
            <td class="invoice-only">
                <input type="number" 
                       class="actual-price" 
                       value="${item.actual_price || ''}"
                       placeholder="${item.actual_price || ''}">
            </td>
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
                                        ${item.username === localStorage.getItem("username") ?
                                        `<button class="delete-image-btn" 
                                                onclick="deleteInvoiceImage('${item.serial_number}', '${file}', this)">
                                            ×
                                        </button>`:
                                        ''}
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
                ${(item.status === '學校匯款'||'已還款') ? 
                    `<span>${item.school_reimbursement_status}</span>`:
                    `<select onchange="updateReimbursementStatus(this, ${item.serial_number}) ">
                        <option value="無發票" ${(!item.invoice_files || item.invoice_files.length === 0) ? 'selected' : ''}>無發票</option>
                        <option value="未送出" ${(item.invoice_files && item.invoice_files.length > 0 && (!item.school_reimbursement_status || item.school_reimbursement_status === '未送出')) ? 'selected' : ''}>未送出</option>
                        <option value="已送出" ${item.school_reimbursement_status === '已送出' ? 'selected' : ''}>已送出</option>
                    </select>`
                }
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

// **📌 上傳發票**
function handleFileUpload(input) {
    const files = input.files;
    const serialNumber = input.dataset.serial;
    const previewContainer = input.nextElementSibling;

    if (!files.length) {
        alert('請選擇檔案');
        return;
    }

    // 保留現有的預覽圖片
    const existingPreviews = previewContainer.innerHTML;

    // 新增檔案預覽
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.createElement('img');
                preview.src = e.target.result;
                preview.style.maxWidth = '100px';
                preview.style.margin = '5px';
                preview.style.cursor = 'pointer';
                preview.onclick = () => showFullImage(e.target.result);
                previewContainer.appendChild(preview);
            };
            reader.readAsDataURL(file);
        }
    });

    const formData = new FormData();
    Array.from(files).forEach(file => {
        formData.append('files', file);
    });

    fetch(`${apiUrl}/invoice/upload/${serialNumber}`, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: formData
        })
        .then(res => {
            if (!res.ok) {
                // 如果上傳失敗，恢復原有的預覽
                previewContainer.innerHTML = existingPreviews;
                throw new Error(`上傳失敗: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('上傳成功', data);
            alert('檔案上傳成功');
            loadAndRenderData("purchase-list-invoice");
        })
        .catch(error => {
            console.error('上傳失敗：', error);
            alert(`檔案上傳失敗: ${error.message}`);
        });
}

// **📌 更新發票資料**
function updateInvoiceData(button) {
    const row = button.closest('tr');
    const purchaseId = row.getAttribute('data-purchase-id');
    const purchaseDate = row.querySelector('.purchase-date').value;
    const actualPrice = row.querySelector('.actual-price').value;
    // 驗證輸入
    if (!purchaseDate && !actualPrice) {
        alert('請至少填一項資料');
        return;
    }
    const data = {
        purchaseDate: purchaseDate,
        actualPrice: actualPrice
    };
    fetch(`${apiUrl}/invoice/update/${purchaseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`更新失敗: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            alert(data.message);
            loadAndRenderData("purchase-list-invoice");
        })
        .catch(error => {
            console.error('更新失敗：', error);
            alert(`更新失敗: ${error.message}`);
        });
}
// **📌 刪除發票圖片**
function deleteInvoiceImage(serial, filename,btn) {
    console.log(serial, filename, username);
    if (!confirm('確定刪除這張發票嗎？')) return;
    fetch(`${apiUrl}/invoice/delete/${serial}/${encodeURIComponent(filename)}`, {
        method : 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(res => {
        if (!res.ok) throw new Error(`刪除失敗 (${res.status})`);
        return res.json();
    })
    .then(data => {
        alert(data.message);
        // 1) 從畫面即時移除這張小圖
        const wrapper = btn.closest('.image-wrapper');
        if (wrapper) wrapper.remove();
        // 2) 若想全面刷新再加上：
        // loadAndRenderData('purchase-list-invoice');
    })
    .catch(err => {
        console.error('刪除圖片失敗：', err);
        alert(`刪除失敗：${err.message}`);
    });
}