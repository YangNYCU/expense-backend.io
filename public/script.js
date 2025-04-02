const apiUrl = "http://localhost:5001/api"; // Node.js 伺服器 API 地址
// **📌 註冊**
function register() {
    const username = document.getElementById("register-username").value;
    const password = document.getElementById("register-password").value;
    const role = document.getElementById("register-role").value;
    const email = document.getElementById("register-email").value;
    const bank = document.getElementById("register-bank").value;
    const bank_account = document.getElementById("register-bank-account").value;

    fetch(`${apiUrl}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // 傳入 username、password 與 role 參數
            body: JSON.stringify({
                username,
                password,
                role,
                email,
                bank,
                bank_account
            })
        })
        .then(res => res.json())
        .then(data => alert(data.message));
}

// **📌 登入**
function login() {
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    if (!usernameInput || !passwordInput) {
        alert("找不到登入表單元素，請聯絡管理員");
        return;
    }
    const username = usernameInput.value;
    const password = passwordInput.value;
    if (!username || !password) {
        alert("請輸入使用者名稱和密碼");
        return;
    }
    fetch(`${apiUrl}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.token) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("role", data.role);
                localStorage.setItem("username", username);
                document.getElementById("login-form").style.display = "none";
                document.getElementById("register-section").style.display = "none";
                document.getElementById("function-section").style.display = "block";
                // 載入用戶資料
                loadUserInfo();
                // 根據用戶角色更新功能按鈕
                const approveButton = document.querySelector('button[onclick="approve()"]');
                if (data.role !== "finance") {
                    approveButton.style.display = "none";
                } else {
                    approveButton.style.display = "";
                }
                loadAndRenderData("purchase-list-purchase");
            } else {
                alert(data.message || "登入失敗");
            }
        })
        .catch(error => {
            console.error("登入錯誤:", error);
            alert("登入發生錯誤，請稍後再試");
        });
}

// **📌 登出**
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    // 清空用戶資料顯示
    document.getElementById("info-username").textContent = '';
    document.getElementById("info-role").textContent = '';
    document.getElementById("info-email").textContent = '';
    document.getElementById("info-bank").textContent = '';
    document.getElementById("info-bank-account").textContent = '';
    location.reload();
}
// **📌 功能選擇**
function functionSelect() {
    const select = document.getElementById("function-list").value;
    const userRole = localStorage.getItem("role");
    const systems = {
        purchase: ["notation", "purchase-list-purchase"],
        invoice: ["invoice-sys", "purchase-list-invoice"],
        approve: ["approve-sys", "purchase-list-approve"]
    };
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });

    // 顯示選擇的系統
    if (select in systems) {
        // 檢查是否為財務人員才能訪問審核功能
        if (select === "approve" && userRole !== "finance") {
            alert("只有財務人員可以使用審核功能");
            return;
        }
        document.getElementById(systems[select][0]).style.display = "none";
        if (select !== "purchase") { // 採購系統需要先同意注意事項
            loadAndRenderData(systems[select][1]);
        }
    }
}

// 處理注意事項同意
function handleNotationAcceptance() {
    if (document.getElementById("noted").checked) {
        document.getElementById("notation").style.display = "none";
        document.getElementById("purchase-sys").style.display = "block";
        loadAndRenderData("purchase-list-purchase");
    } else {
        alert("請勾選同意");
    }
}

// 日期格式化函數
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
}

// 載入採購清單
function loadPurchases() {
    loadAndRenderData("purchase-list-purchase");
}

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
// 學校報帳相關變數
let selectedPurchases = new Set();

// 開啟學校報帳 Modal
function openReimbursementModal() {
    const modal = document.getElementById("reimbursement-modal");
    modal.style.display = "block";
    updateSelectedRecordsList();
}

// 關閉學校報帳 Modal
function closeReimbursementModal() {
    const modal = document.getElementById("reimbursement-modal");
    modal.style.display = "none";
    selectedPurchases.clear();
    document.getElementById("reimbursement-id").value = "";
    updateSelectedRecordsList();
}

// 更新已選擇記錄的列表
function updateSelectedRecordsList() {
    const list = document.getElementById("selected-records-list");
    list.innerHTML = Array.from(selectedPurchases).map(id => {
        const row = document.querySelector(`tr[data-purchase-id="${id}"]`);
        if (row) {
            const serialNumber = row.cells[0].textContent;
            const purchaseDesc = row.cells[1].textContent;
            return `<li>序號：${serialNumber} - ${purchaseDesc}</li>`;
        }
        return "";
    }).join("");
}

// 切換選擇狀態
function togglePurchaseSelection(checkbox) {
    const purchaseId = checkbox.closest('tr').getAttribute('data-purchase-id');
    if (checkbox.checked) {
        if (selectedPurchases.size >= 5) {
            checkbox.checked = false;
            alert('最多只能選擇5筆記錄');
            return;
        }
        selectedPurchases.add(purchaseId);
    } else {
        selectedPurchases.delete(purchaseId);
    }
    updateSelectedRecordsList();
}

// 提交學校報帳
function submitReimbursement() {
    const reimbursementId = document.getElementById("reimbursement-id").value.trim();
    if (!reimbursementId) {
        alert('請輸入學校報帳編號');
        return;
    }
    if (selectedPurchases.size === 0) {
        alert('請至少選擇一筆記錄');
        return;
    }
    fetch(`${apiUrl}/purchase/reimbursement`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({
                purchaseIds: Array.from(selectedPurchases),
                reimbursementId: reimbursementId
            })
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => {
                    throw new Error(data.message || '更新失敗');
                });
            }
            return res.json();
        })
        .then(data => {
            alert(data.message);
            closeReimbursementModal();
            loadAndRenderData("purchase-list-approve");
        })
        .catch(error => {
            console.error('更新學校報帳狀態失敗：', error);
            alert(`更新失敗：${error.message}`);
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

function updateInvoiceData(button) {
    const row = button.closest('tr');
    const purchaseId = row.getAttribute('data-purchase-id');
    const purchaseDate = row.querySelector('.purchase-date').value;
    const actualPrice = row.querySelector('.actual-price').value;

    // 驗證輸入
    if (!purchaseDate || !actualPrice) {
        alert('請填寫採購日期和實際金額');
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


// **📌 匯出採購資料**
function exportToExcel() {
    // 先取得採購資料
    fetch(`${apiUrl}/purchase`, {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        })
        .then(res => res.json())
        .then(data => {
            // 將 JSON 資料轉換為工作表
            const worksheet = XLSX.utils.json_to_sheet(data);
            // 建立新的工作簿
            const workbook = XLSX.utils.book_new();
            // 將工作表加入工作簿，工作表名稱為 "Purchases"
            XLSX.utils.book_append_sheet(workbook, worksheet, "Purchases");
            // 觸發下載，檔名為 "purchases.xlsx"
            XLSX.writeFile(workbook, "purchases.xlsx");
        });
}

// **📌 上傳發票**
function uploadInvoice() {
    const fileInput = document.getElementById("invoice-file").files[0];
    const formData = new FormData();
    formData.append("file", fileInput);

    fetch(`${apiUrl}/invoice/upload/${serial_number}`, {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => alert(data.message));
}

// **📌 加載審核列表**
function loadApprovals() {
    fetch(`${apiUrl}/purchase?sort=serial_number`, { // 添加排序參數
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
            renderPurchaseData(data, "purchase-list-approve");
        });
}

function updateApprovalStatus(selectElement) {
    const purchaseId = selectElement.closest('td').dataset.id;
    const status = selectElement.value;
    const token = localStorage.getItem("token");

    fetch(`${apiUrl}/purchase/${purchaseId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                status
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.message) {
                alert('狀態更新成功');
                loadApprovals();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('更新失敗，請稍後再試');
            // 如果更新失敗，恢復原本的選項
            loadPurchases();
        });
}

// 開啟新增採購彈窗
function openPurchaseModal() {
    const modal = document.getElementById("purchase-modal");
    modal.style.display = "block";
}

// 關閉新增採購彈窗
function closePurchaseModal() {
    document.getElementById("purchase-modal").style.display = "none";
}

// 提交新採購申請
function submitPurchase() {
    const purchaseData = {
        team: document.getElementById("team").value,
        purchase_desc: document.getElementById("purchase-desc").value,
        system_type: document.getElementById("system-type").value,
        use: document.getElementById("use").value,
        amount: document.getElementById("amount").value,
        total_cost: document.getElementById("total-cost").value,
        purchase_import: document.getElementById("import").value,
        purchase_note: document.getElementById("purchase-note").value
    };

    fetch(`${apiUrl}/purchase`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(purchaseData)
    })
    .then(res => {
        if (!res.ok) {
            return res.text().then(text => {
                throw new Error(text || '提交失敗');
            });
        }
        return res.json();
    })
    .then(data => {
        alert("採購申請已提交！");
        closePurchaseModal();
        loadAndRenderData("purchase-list-purchase");
    })
    .catch(error => {
        alert(`提交失敗：${error.message}`);
        console.error("Error:", error);
    });
}

// 修改點擊彈窗外區域關閉的事件處理
window.onclick = function(event) {
    const purchaseModal = document.getElementById("purchase-modal");
    const editModal = document.getElementById("edit-modal");
    const editProfileModal = document.getElementById("edit-profile-modal");
    
    if (event.target == purchaseModal) {
        purchaseModal.style.display = "none";
    }
    if (event.target == editModal) {
        editModal.style.display = "none";
    }
    if (event.target == editProfileModal) {
        editProfileModal.style.display = "none";
    }
}

// 開啟修改彈窗
function openEditModal() {
    const modal = document.getElementById("edit-modal");
    const serialSelect = document.getElementById("edit-serial");
    
    // 清空現有選項
    serialSelect.innerHTML = '<option value="">請選擇申請編號</option>';
    
    // 獲取當前用戶的採購申請列表
    fetch(`${apiUrl}/purchase`, {
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => res.json())
    .then(data => {
        // 儲存資料到全域變數，供後續使用
        window.purchaseData = data;
        
        // 只顯示當前用戶且狀態為"待審核"的申請
        const userPurchases = data.filter(p => 
            p.username === localStorage.getItem("username") && 
            p.status === "待審核"
        );
        
        userPurchases.forEach(purchase => {
            const option = document.createElement("option");
            option.value = purchase.id;
            option.textContent = `${purchase.serial_number} - ${purchase.purchase_desc}`;
            serialSelect.appendChild(option);
        });
    });
    
    modal.style.display = "block";
}

// 當選擇申請編號時載入資料
document.getElementById("edit-serial").addEventListener("change", function() {
    const purchaseId = this.value;
    const editForm = document.getElementById("edit-form");
    
    if (!purchaseId) {
        editForm.style.display = "none";
        return;
    }
    // 從已儲存的資料中找出對應的申請
    const purchaseData = window.purchaseData.find(p => p.id === parseInt(purchaseId));
    if (purchaseData) {
        // 填充表單資料
        document.getElementById("edit-team").value = purchaseData.team;
        document.getElementById("edit-purchase-desc").value = purchaseData.purchase_desc;
        document.getElementById("edit-system-type").value = purchaseData.system_type;
        document.getElementById("edit-use").value = purchaseData.use;
        document.getElementById("edit-amount").value = purchaseData.amount;
        document.getElementById("edit-total-cost").value = purchaseData.total_cost;
        document.getElementById("edit-import").value = purchaseData.purchase_import;
        document.getElementById("edit-purchase-note").value = purchaseData.purchase_note || '';
        editForm.style.display = "block";
    }
});

// 提交修改
function submitEdit() {
    const purchaseId = document.getElementById("edit-serial").value;
    const updatedData = {
        id: purchaseId,  // 添加 id
        team: document.getElementById("edit-team").value,
        purchase_desc: document.getElementById("edit-purchase-desc").value,
        system_type: document.getElementById("edit-system-type").value,
        use: document.getElementById("edit-use").value,
        amount: document.getElementById("edit-amount").value,
        total_cost: document.getElementById("edit-total-cost").value,
        purchase_import: document.getElementById("edit-import").value,
        purchase_note: document.getElementById("edit-purchase-note").value,
        status: "待審核"  // 確保狀態保持不變
    };
    
    // 改用 POST 方法，並將資料放在請求體中
    fetch(`${apiUrl}/purchase/update`, {
        method: "POST",  // 改用 POST 方法
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(updatedData)
    })
    .then(res => {
        if (!res.ok) {
            return res.text().then(text => {
                throw new Error(text || '修改失敗');
            });
        }
        return res.json();
    })
    .then(data => {
        alert("修改成功！");
        closeEditModal();
        loadAndRenderData("purchase-list-purchase");
    })
    .catch(error => {
        alert(`修改失敗：${error.message}`);
        console.error("Error:", error);
    });
}

// 關閉修改彈窗
function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
    document.getElementById("edit-form").style.display = "none";
}

// 刪除採購申請
function deletePurchase(id) {
    if (!confirm("確定要刪除這筆採購申請嗎？此操作不可恢復！")) {
        return;
    }
    
    fetch(`${apiUrl}/purchase/${id}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => {
        if (!res.ok) {
            return res.text().then(text => {
                throw new Error(text || '刪除失敗');
            });
        }
        return res.json();
    })
    .then(data => {
        alert("採購申請已刪除！");
        loadAndRenderData("purchase-list-purchase");
    })
    .catch(error => {
        alert(`刪除失敗：${error.message}`);
        console.error("Error:", error);
    });
}

// 新增全螢幕查看圖片的功能
function showFullImage(src) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        cursor: pointer;
    `;

    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
    `;

    modal.appendChild(img);
    document.body.appendChild(modal);

    modal.onclick = () => {
        document.body.removeChild(modal);
    };
}

// 顯示不同的審核頁籤
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.getElementById(tabId).style.display = 'block';
    
    if (tabId === 'member-approval') {
        loadPendingMembers();
    } else if (tabId === 'user-list') {
        loadUsers();
    }
}

// 載入待審核成員
function loadPendingMembers() {
    fetch(`${apiUrl}/users/pending`, {
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById('pending-members-list');
        list.innerHTML = data.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.email || ''}</td>
                <td>${user.bank || ''}</td>
                <td>${user.bank_account || ''}</td>
                <td>${new Date(user.regist_time).toLocaleString("zh-TW")}</td>
                <td>
                    <button onclick="approveMember(${user.id}, 'approved')">通過</button>
                    <button onclick="approveMember(${user.id}, 'rejected')">拒絕</button>
                </td>
            </tr>
        `).join('');
    })
    .catch(error => {
        console.error('載入待審核成員失敗：', error);
        alert('載入待審核成員失敗');
    });
}

// 審核成員
function approveMember(userId, status) {
    fetch(`${apiUrl}/users/${userId}/approve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ status })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        loadPendingMembers();
    })
    .catch(error => {
        console.error('成員審核失敗：', error);
        alert('成員審核失敗');
    });
}

// 修改載入用戶列表函數
function loadUsers() {
    fetch(`${apiUrl}/users`, {
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById('users-list');
        list.innerHTML = data.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.email || ''}</td>
                <td>${user.bank || ''}</td>
                <td>${user.bank_account || ''}</td>
                <td>${translateRole(user.role)}</td>
                <td>${translateStatus(user.status)}</td>
                <td>${new Date(user.regist_time).toLocaleString("zh-TW")}</td>
                <td>
                    ${user.role !== 'finance' ? 
                        `<button onclick="deleteUser(${user.id}, '${user.username}')" class="delete-btn">刪除</button>` : 
                        ''}
                </td>
            </tr>
        `).join('');
    })
    .catch(error => {
        console.error('載入用戶列表失敗：', error);
        alert('載入用戶列表失敗');
    });
}

// 修改刪除用戶函數
function deleteUser(userId, username) {
    if (!confirm(`確定要刪除用戶 ${username} 嗎？此操作不可恢復！\n注意：刪除用戶將同時刪除該用戶的所有採購記錄。`)) {
        return;
    }

    fetch(`${apiUrl}/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(data => {
                throw new Error(data.message || '刪除失敗');
            });
        }
        return res.json();
    })
    .then(data => {
        alert(data.message);
        loadUsers(); // 重新載入用戶列表
        // 如果在用戶列表頁面，也重新載入待審核成員列表
        if (document.getElementById('member-approval').style.display !== 'none') {
            loadPendingMembers();
        }
    })
    .catch(error => {
        console.error('刪除用戶失敗：', error);
        alert(`刪除用戶失敗：${error.message}`);
    });
}

// 角色翻譯函數
function translateRole(role) {
    const roleMap = {
        'user': '一般用戶',
        'finance': '財務人員'
    };
    return roleMap[role] || role;
}

// 狀態翻譯函數
function translateStatus(status) {
    const statusMap = {
        'pending': '待審核',
        'approved': '已通過',
        'rejected': '已拒絕'
    };
    return statusMap[status] || status;
}

// 新增功能按鈕點擊處理函數
function purchase() {
    const userRole = localStorage.getItem("role");
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });
    
    // 顯示採購須知系統
    document.getElementById("notation").style.display = "block";
}

function invoice() {
    const userRole = localStorage.getItem("role");
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });
    
    // 顯示發票上傳系統並載入資料
    document.getElementById("invoice-sys").style.display = "block";
    loadAndRenderData("purchase-list-invoice");
}

function approve() {
    const userRole = localStorage.getItem("role");
    // 檢查是否為財務人員
    if (userRole !== "finance") {
        alert("只有財務人員可以使用審核功能");
        return;
    }
    // 隱藏所有系統
    ["notation", "purchase-sys", "invoice-sys", "approve-sys"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });
    // 顯示審核系統並載入資料
    document.getElementById("approve-sys").style.display = "block";
    loadAndRenderData("purchase-list-approve");
    // 預設顯示採購審核頁籤
    showTab('purchase-approval');
}

// 新增載入用戶資料的函數
function loadUserInfo() {
    fetch(`${apiUrl}/users/profile`, {
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => {
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                throw new Error('登入已過期，請重新登入');
            }
            throw new Error(`載入失敗 (${res.status})`);
        }
        return res.json();
    })
    .then(data => {
        // 更新用戶資料顯示
        document.getElementById("info-username").textContent = data.username;
        document.getElementById("info-role").textContent = translateRole(data.role);
        document.getElementById("info-email").textContent = data.email || '未設定';
        document.getElementById("info-bank").textContent = data.bank || '未設定';
        document.getElementById("info-bank-account").textContent = data.bank_account || '未設定';
    })
    .catch(error => {
        console.error('載入用戶資料失敗：', error);
        if (error.message.includes('登入已過期')) {
            alert('登入已過期，請重新登入');
            logout();
        }
    });
}

// 開啟修改個人資料彈窗
function openEditProfileModal() {
    const modal = document.getElementById("edit-profile-modal");
    
    // 載入現有資料到表單中
    fetch(`${apiUrl}/users/profile`, {
        headers: {
            "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("edit-profile-email").value = data.email || '';
        document.getElementById("edit-profile-bank").value = data.bank || '';
        document.getElementById("edit-profile-bank-account").value = data.bank_account || '';
    })
    .catch(error => {
        console.error('載入用戶資料失敗：', error);
        alert('載入用戶資料失敗');
    });

    modal.style.display = "block";
}

// 關閉修改個人資料彈窗
function closeEditProfileModal() {
    document.getElementById("edit-profile-modal").style.display = "none";
}

// 提交個人資料修改
function submitProfileEdit() {
    const updateData = {
        email: document.getElementById("edit-profile-email").value,
        bank: document.getElementById("edit-profile-bank").value,
        bank_account: document.getElementById("edit-profile-bank-account").value,
        password: document.getElementById("edit-profile-password").value
    };

    // 如果密碼欄位為空，則不更新密碼
    if (!updateData.password) {
        delete updateData.password;
    }

    // 檢查是否有任何欄位要更新
    if (!updateData.email && !updateData.bank && !updateData.bank_account && !updateData.password) {
        alert('請至少填寫一個要更新的欄位');
        return;
    }

    fetch(`${apiUrl}/users/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(updateData)
    })
    .then(res => {
        if (!res.ok) {
            // 先檢查是否為 401 或 403 錯誤
            if (res.status === 401 || res.status === 403) {
                alert('登入已過期，請重新登入');
                logout();
                return;
            }
            return res.text().then(text => {
                try {
                    // 嘗試解析為 JSON
                    const data = JSON.parse(text);
                    throw new Error(data.message || '更新失敗');
                } catch (e) {
                    // 如果不是有效的 JSON，直接使用錯誤文本
                    throw new Error(`更新失敗 (${res.status}): ${text}`);
                }
            });
        }
        return res.json();
    })
    .then(data => {
        if (data) {  // 確保有回應資料
            alert(data.message || '更新成功');
            closeEditProfileModal();
            loadUserInfo(); // 重新載入用戶資料
        }
    })
    .catch(error => {
        console.error('更新個人資料失敗：', error);
        if (error.message.includes('登入已過期')) {
            logout();
        } else {
            alert(`更新失敗：${error.message}`);
        }
    });
}

// 修改刪除照片的函數
function deleteInvoiceImage(serialNumber, filename, button) {
    if (!confirm('確定要刪除這張發票照片嗎？')) {
        return;
    }

    // 對檔案名稱進行編碼
    const encodedFilename = encodeURIComponent(filename);

    fetch(`${apiUrl}/invoice/delete/${serialNumber}/${encodedFilename}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`刪除失敗: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        // 找到並移除圖片容器
        const imageWrapper = button.closest('.image-wrapper');
        if (imageWrapper) {
            imageWrapper.remove();
        }
        alert('照片已成功刪除');
        
        // 重新載入資料以確保顯示正確
        loadAndRenderData("purchase-list-invoice");
    })
    .catch(error => {
        console.error('刪除照片失敗：', error);
        alert(`刪除照片失敗: ${error.message}`);
    });
}

// 新增更新學校報帳狀態的函數
function updateReimbursementStatus(selectElement, purchaseId) {
    const status = selectElement.value;
    
    fetch(`${apiUrl}/purchase/${purchaseId}/reimbursement-status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
            status
        })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`更新失敗: ${res.status}`);
        }
        return res.json();
    })
    .then(data => {
        alert('狀態更新成功');
        loadAndRenderData("purchase-list-approve");
    })
    .catch(error => {
        console.error('更新狀態失敗：', error);
        alert(`更新失敗：${error.message}`);
        // 如果更新失敗，重新載入資料
        loadAndRenderData("purchase-list-approve");
    });
}