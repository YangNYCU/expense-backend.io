// 日期格式化函數
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
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