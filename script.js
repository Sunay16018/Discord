let currentChat = null;
const currentUser = document.querySelector('.avatar').nextElementSibling.innerText;
const chatPanel = document.getElementById('chatPanel');

// Kullanıcıları Yükle
function loadUsers() {
    fetch('core.php?get_users=true')
        .then(res => res.json())
        .then(users => {
            const list = document.getElementById('userList');
            list.innerHTML = '';
            users.forEach(u => {
                if (u.username === currentUser) return;
                
                const div = document.createElement('div');
                div.className = 'user-item';
                div.innerHTML = `<div class="avatar"></div> ${u.username}`;
                div.onclick = () => openChat(u.username);
                list.appendChild(div);
            });
        });
}

// Mobilde Sohbeti Aç
function openChat(username) {
    currentChat = username;
    document.getElementById('chatTitle').innerText = username;
    document.getElementById('msgInput').disabled = false;
    document.getElementById('msgInput').focus();
    
    // Mobil için paneli kaydır
    chatPanel.classList.add('active');
    
    loadMessages();
}

// Mobilde Sohbeti Kapat (Geri Dön)
function closeChat() {
    currentChat = null;
    chatPanel.classList.remove('active');
}

// Mesajları Yükle
function loadMessages() {
    if (!currentChat) return;
    
    fetch(`core.php?get_chat=${currentChat}`)
        .then(res => res.json())
        .then(msgs => {
            const box = document.getElementById('messageBox');
            let html = '';
            
            if(msgs.length === 0) html = '<div style="padding:20px; text-align:center; color:gray;">Henüz mesaj yok.</div>';
            
            msgs.forEach(m => {
                let text = m.msg.replace(/:)/g, '😊').replace(/<3/g, '❤️');
                let time = new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                html += `
                    <div class="message">
                        <div class="avatar" style="width:35px; height:35px;"></div>
                        <div class="msg-bubble">
                            <div class="msg-info">
                                <span style="font-weight:bold; color:${m.sender === currentUser ? '#00b0f4' : 'white'}">${m.sender}</span>
                                <span class="msg-time">${time}</span>
                            </div>
                            <div class="msg-text">${text}</div>
                        </div>
                    </div>`;
            });
            
            box.innerHTML = html;
            box.scrollTop = box.scrollHeight;
        });
}

// Mesaj Gönder
document.getElementById('msgInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && this.value.trim() !== '') {
        let fd = new FormData();
        fd.append('send_msg', '1');
        fd.append('receiver', currentChat);
        fd.append('msg', this.value);
        
        fetch('core.php', { method: 'POST', body: fd })
            .then(() => {
                this.value = '';
                loadMessages();
            });
    }
});

// Başlangıç
loadUsers();
setInterval(() => { if(currentChat) loadMessages(); }, 2000); // 2 saniyede bir mesajları yenile
setInterval(loadUsers, 10000); // 10 saniyede bir kullanıcıları yenile
