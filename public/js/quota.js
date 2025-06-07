function loadQuotas() {
    fetch(`${apiUrl}/quotas`, {
            headers: {
                
            }
        })
        .then(res => {
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error('登入已過期，請重新登入');
                }
                throw new Error(`載入配額失敗 (${res.status})`);
            }
            return res.json();
        })
        .then(data => {
            const list = document.getElementById("quota-list-body");
            list.innerHTML = data.data.map(quota => `
            <tr>
                <td>${quota.team}</td>
                <td>NT$${quota.quota.toLocaleString()}</td>
                <td><input type="number" min="0" class="new-quota" value="${quota.quota}"></td>
                <td><button onclick="updateQuota('${quota.team}', this)">更新</button></td>
            </tr>
        `).join('');
        })
        .catch(error => {
            console.error('載入配額失敗：', error);
            if (error.message.includes('登入已過期')) {
                alert('登入已過期，請重新登入');
                logout();
            } else {
                alert(`載入配額失敗：${error.message}`);
            }
        });
}

function updateQuota(team, button) {
    const row = button.closest('tr');
    const newQuota = parseFloat(row.querySelector('.new-quota').value);
    if (isNaN(newQuota) || newQuota < 0) {
        alert('請輸入有效的配額');
        return;
    }
    fetch(`${apiUrl}/quotas`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({ team, quota: newQuota })
        })
        .then(res => {
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    throw new Error('登入已過期，請重新登入');
                }
                return res.json().then(data => {
                    throw new Error(data.message || '更新失敗');
                });
            }
            return res.json();
        })
        .then(data => {
            alert(data.message);
            loadQuotas();
        })
        .catch(error => {
            console.error('更新配額失敗：', error);
            if (error.message.includes('登入已過期')) {
                logout();
            } else {
                alert(`更新配額失敗：${error.message}`);
            }
        });
}