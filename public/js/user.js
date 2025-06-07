// 新增載入用戶資料的函數
function loadUserInfo() {
    const username = localStorage.getItem('username');
    if (!username) {
        console.error('未找到用戶名');
        return;
    }

    fetch(`${apiUrl}/users/profile/${username}`)
        .then(res => {
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error('登入已過期，請重新登入');
                }
                throw new Error(`載入失敗 (${res.status})`);
            }
            return res.json();
        })
        .then(user => {
            // 更新用戶資料顯示
            document.getElementById("info-username").textContent = user.data.username;
            document.getElementById("info-role").textContent = translateRole(user.data.role);
            document.getElementById("info-email").textContent = user.data.email || '未設定';
            document.getElementById("info-bank").textContent = user.data.bank || '未設定';
            document.getElementById("info-bank-account").textContent = user.data.bank_account || '未設定';
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
    const username = localStorage.getItem('username');
    if (!username) {
        alert('未找到用戶資訊，請重新登入');
        return;
    }

    // 載入現有資料到表單中
    fetch(`${apiUrl}/users/profile/${username}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById("edit-profile-email").value = data.data.email || '';
            document.getElementById("edit-profile-bank").value = data.data.bank || '';
            document.getElementById("edit-profile-bank-account").value = data.data.bank_account || '';
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
    const username = localStorage.getItem('username');
    if (!username) {
        alert('未找到用戶資訊，請重新登入');
        return;
    }

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
    fetch(`${apiUrl}/users/profile/${username}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
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
            if (data) { // 確保有回應資料
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