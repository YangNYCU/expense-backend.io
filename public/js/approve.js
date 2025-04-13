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