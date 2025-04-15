// 顯示不同的審核頁籤
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.getElementById(tabId).style.display = 'block';
    if (tabId === 'purchase-approval') {
        loadApprovals();
    } else if (tabId === 'pending-list') {
        loadPendingMembers();
    } else if (tabId === 'user-list') {
        loadUsers();
    }
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


// 載入待審核成員
function loadPendingMembers() {
    fetch(`${apiUrl}/users/pending`, {
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        })
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('pending-list-body');
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
                const list = document.getElementById('users-list-body');
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
        if (document.getElementById('pending-members-list').style.display !== 'none') {
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