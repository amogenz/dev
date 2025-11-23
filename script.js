let client;
let myName = "";
let myRoom = "";
let storageTopic = ""; 
const broadcastTopic = "aksara-global-v1/announcements";

const notifAudio = document.getElementById('notifSound');
const sentAudio = document.getElementById('sentSound');


const ADMIN_HASH_KEY = "1802662251"; 

let mediaRecorder, audioChunks = [], isRecording = false, audioBlobData = null;
let isSoundOn = true;
let sendOnEnter = true;
let replyingTo = null; 
let onlineUsers = {};
let typingTimeout;
let localChatHistory = []; 

// --- FUNGSI PENGACAK (HASHING) ---
// Fungsi ini mengubah teks menjadi angka unik.
function generateHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Menggunakan Math.abs agar angkanya positif (biar rapi)
    return Math.abs(hash).toString();
}

// --- TOAST FUNCTION ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';
    
    // Style warna icon
    let color = '#007AFF';
    if (type === 'error') color = '#ff4444';
    if (type === 'success') color = '#34C759';

    toast.innerHTML = `<i class="material-icons" style="color:${color}">${icon}</i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// --- INIT ---
window.onload = function() {
    if(localStorage.getItem('aksara_name')) document.getElementById('username').value = localStorage.getItem('aksara_name');
    if(localStorage.getItem('aksara_room')) document.getElementById('room').value = localStorage.getItem('aksara_room');
    if(localStorage.getItem('aksara_sound')) document.getElementById('sound-toggle').checked = (localStorage.getItem('aksara_sound') === 'true');
    if(localStorage.getItem('aksara_enter')) document.getElementById('enter-toggle').checked = (localStorage.getItem('aksara_enter') === 'true');
    const savedBg = localStorage.getItem('aksara_bg_image');
    if(savedBg) document.body.style.backgroundImage = `url(${savedBg})`;
};

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.style.left === '0px') { sidebar.style.left = '-350px'; sidebar.classList.remove('active'); overlay.style.display = 'none'; }
    else { sidebar.style.left = '0px'; sidebar.classList.add('active'); overlay.style.display = 'block'; }
}

// --- KONEKSI UTAMA ---
function startChat() {
    const user = document.getElementById('username').value.trim();
    const room = document.getElementById('room').value.trim().toLowerCase();
    if (!user || !room) { showToast("Lengkapi data dulu!", "error"); return; }

    localStorage.setItem('aksara_name', user); localStorage.setItem('aksara_room', room);
    myName = user; myRoom = "aksara-v29/" + room; storageTopic = myRoom + "/storage"; 

    document.getElementById('side-user').innerText = myName;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('room-display').innerText = "#" + room;
    document.getElementById('typing-indicator').innerText = "Menghubungkan...";

    loadFromLocal(); 

    const options = { protocol: 'wss', type: 'mqtt', clean: true, reconnectPeriod: 1000, clientId: 'aks_' + Math.random().toString(16).substr(2, 8) };
    client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', options);

    client.on('connect', () => {
        document.getElementById('typing-indicator').innerText = "";
        client.subscribe(myRoom); 
        client.subscribe(storageTopic);
        client.subscribe(broadcastTopic); // Dengar jalur admin
        
        publishMessage("bergabung.", 'system');
        setInterval(() => { client.publish(myRoom, JSON.stringify({ type: 'ping', user: myName })); cleanOnlineList(); }, 10000);
    });

    client.on('message', (topic, message) => {
        const msgString = message.toString();
        
        // --- LOGIKA ADMIN (GLOBAL BROADCAST) ---
        if (topic === broadcastTopic) {
            try {
                const data = JSON.parse(msgString);
                
                // 1. Bersihkan pesan admin lama (supaya tidak numpuk)
                const existingAdmin = document.querySelectorAll('.message.admin');
                existingAdmin.forEach(el => el.remove());

                // 2. Jika perintah HAPUS, stop di sini (layar jadi bersih)
                if (data.type === 'admin_clear') return;

                // 3. Jika pesan baru, tampilkan
                if (data.type === 'admin') displaySingleMessage(data);
            } catch(e) {}
            return;
        }

        if (topic === storageTopic) { try { const srv = JSON.parse(msgString); if (Array.isArray(srv)) mergeWithLocal(srv); } catch(e) {} return; }
        if (topic === myRoom) { try { const data = JSON.parse(msgString); if (data.type === 'ping') { updateOnlineList(data.user); return; } if (data.type === 'typing') { showTyping(data.user); return; } handleIncomingMessage(data); } catch(e) {} }
    });
}

function loadFromLocal() { const saved = localStorage.getItem(getStorageKey()); if (saved) { localChatHistory = JSON.parse(saved); renderChat(); } }
function saveToLocal() { localStorage.setItem(getStorageKey(), JSON.stringify(localChatHistory)); }
function handleIncomingMessage(data) {
    // Jangan simpan pesan admin/hapus/system di local storage
    if(data.type !== 'system' && data.type !== 'admin' && data.type !== 'admin_clear') {
        if (!localChatHistory.some(msg => msg.id === data.id)) {
            localChatHistory.push(data);
            if (localChatHistory.length > 77) localChatHistory = localChatHistory.slice(-77); 
            saveToLocal(); renderChat(); 
            if (data.user === myName) updateServerStorage();
        }
    } else { displaySingleMessage(data); }
}
function mergeWithLocal(serverData) {
    let changed = false;
    serverData.forEach(srvMsg => { if (!localChatHistory.some(locMsg => locMsg.id === srvMsg.id)) { localChatHistory.push(srvMsg); changed = true; } });
    if (changed) { localChatHistory.sort((a, b) => a.timestamp - b.timestamp); if (localChatHistory.length > 77) localChatHistory = localChatHistory.slice(-77); saveToLocal(); renderChat(); }
}
function updateServerStorage() { client.publish(storageTopic, JSON.stringify(localChatHistory), { retain: true, qos: 1 }); }
function renderChat() {
    const chatBox = document.getElementById('messages');
    chatBox.innerHTML = '<div class="welcome-msg">Messages are encrypted and secure.</div>';
    localChatHistory.forEach(msg => displaySingleMessage(msg));
    setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50);
}

function getStorageKey() { return 'aksara_history_v29_' + myRoom; }
function handleBackgroundUpload(input) {
    const f = input.files[0];
    if(f) { const r = new FileReader(); r.onload = e => { try { localStorage.setItem('aksara_bg_image', e.target.result); document.body.style.backgroundImage = `url(${e.target.result})`; showToast("Background diganti!", "success"); } catch(e){ showToast("Gambar kebesaran!", "error"); } }; r.readAsDataURL(f); }
}
function resetBackground() { localStorage.removeItem('aksara_bg_image'); document.body.style.backgroundImage = ""; showToast("Background dihapus.", "info"); }
function clearChatHistory() { localStorage.removeItem(getStorageKey()); }
function toggleSound() { isSoundOn = document.getElementById('sound-toggle').checked; localStorage.setItem('aksara_sound', isSoundOn); }
function toggleEnterSettings() { sendOnEnter = document.getElementById('enter-toggle').checked; localStorage.setItem('aksara_enter', sendOnEnter); }
function updateOnlineList(user) { onlineUsers[user] = Date.now(); renderOnlineList(); }
function cleanOnlineList() { const now = Date.now(); for (const u in onlineUsers) { if (now - onlineUsers[u] > 25000) delete onlineUsers[u]; } renderOnlineList(); }
function renderOnlineList() { const list = document.getElementById('online-list'); list.innerHTML = ""; for (const u in onlineUsers) { const li = document.createElement('li'); li.innerHTML = `<span style="color:var(--ios-green)">●</span> ${u}`; list.appendChild(li); } }

function publishMessage(content, type = 'text', caption = '') {
    if (!content) return;
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ":" + now.getMinutes().toString().padStart(2,'0');
    const msgId = 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const payload = { id: msgId, user: myName, content: content, type: type, caption: caption, time: time, reply: replyingTo, timestamp: Date.now() };
    
    const topicTarget = (type === 'admin' || type === 'admin_clear') ? broadcastTopic : myRoom;
    const mqttOpts = (type === 'admin' || type === 'admin_clear') ? { retain: true, qos: 1 } : {};

    try { 
        client.publish(topicTarget, JSON.stringify(payload), mqttOpts); 
        if (isSoundOn && type !== 'system' && type !== 'admin' && type !== 'admin_clear') { 
            sentAudio.volume = 0.4; sentAudio.currentTime = 0; sentAudio.play().catch(() => {}); 
        }
    } catch(e) { showToast("Gagal mengirim!", "error"); }
    
    if (type !== 'admin' && type !== 'admin_clear') cancelReply();
}

// --- LOGIKA KIRIM PESAN (DENGAN KEAMANAN HASH) ---
function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    
    if (!text) return;

    // 1. JIKA PERINTAH ADMIN: /admin [pass] [pesan]
    if (text.startsWith('/admin')) {
        // Regex untuk memisahkan: /admin (spasi) password (spasi) pesan
        const match = text.match(/^\/admin\s+(\S+)\s+(.+)/);
        
        if (match) {
            const passInput = match[1];
            const messageContent = match[2];
            
            // Cek Hash
            if (generateHash(passInput) === ADMIN_HASH_KEY) {
                publishMessage(messageContent, 'admin');
                showToast("Pesan Admin Terkirim!", "success");
            } else {
                showToast("Akses Ditolak: Password Salah!", "error");
            }
        } else {
            showToast("Format Salah! /admin [sandi] [pesan]", "error");
        }
        input.value = ''; input.style.height = 'auto'; input.focus();
        return;
    }

    // 2. JIKA PERINTAH HAPUS: /hapusadmin [pass]
    if (text.startsWith('/hapusadmin')) {
        const match = text.match(/^\/hapusadmin\s+(\S+)/);
        
        if (match) {
            const passInput = match[1];
            if (generateHash(passInput) === ADMIN_HASH_KEY) {
                publishMessage('clear', 'admin_clear');
                showToast("Pesan Admin Dihapus!", "success");
            } else {
                showToast("Akses Ditolak: Password Salah!", "error");
            }
        } else {
            showToast("Format Salah! /hapusadmin [sandi]", "error");
        }
        input.value = ''; input.style.height = 'auto'; input.focus();
        return;
    }

    // 3. PESAN BIASA
    publishMessage(text, 'text'); 
    input.value = ''; input.style.height = 'auto'; input.focus();
}

function handleEnter(e) { if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) { e.preventDefault(); sendMessage(); } }

function setReply(id, user, text) { replyingTo = { id: id, user: user, text: text }; document.getElementById('reply-preview-bar').style.display = 'flex'; document.getElementById('reply-to-user').innerText = user; document.getElementById('reply-preview-text').innerText = text.substring(0,50)+'...'; document.getElementById('msg-input').focus(); }
function cancelReply() { replyingTo = null; document.getElementById('reply-preview-bar').style.display = 'none'; }
function scrollToMessage(msgId) { const el = document.getElementById(msgId); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash-highlight'); setTimeout(() => el.classList.remove('flash-highlight'), 1000); } else { showToast("Pesan tidak ditemukan.", "info"); } }

async function toggleRecording() {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream); audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => { audioBlobData = new Blob(audioChunks, { type: 'audio/webm' }); document.getElementById('vn-player').src = URL.createObjectURL(audioBlobData); document.getElementById('vn-preview-bar').style.display = 'flex'; document.getElementById('main-input-area').style.display = 'none'; };
            mediaRecorder.start(); isRecording = true; document.getElementById('mic-btn').classList.add('recording');
        } catch (err) { showToast("Butuh izin mic!", "error"); }
    } else { mediaRecorder.stop(); isRecording = false; document.getElementById('mic-btn').classList.remove('recording'); }
}
function sendVoiceNote() { const r = new FileReader(); r.readAsDataURL(audioBlobData); r.onloadend = () => { publishMessage(r.result, 'audio'); cancelVoiceNote(); }; }
function cancelVoiceNote() { audioBlobData = null; document.getElementById('vn-preview-bar').style.display = 'none'; document.getElementById('main-input-area').style.display = 'flex'; }

function handleImageUpload(input) { const f = input.files[0]; if (f) { const r = new FileReader(); r.onload = e => { document.getElementById('preview-img').src = e.target.result; document.getElementById('image-preview-modal').style.display = 'flex'; }; r.readAsDataURL(f); } input.value = ""; }
function triggerImageUpload() { document.getElementById('chat-file-input').click(); }
function cancelImagePreview() { document.getElementById('image-preview-modal').style.display = 'none'; document.getElementById('img-caption').value=""; }
function sendImageWithCaption() {
    const caption = document.getElementById('img-caption').value.trim(); const img = new Image(); img.src = document.getElementById('preview-img').src;
    img.onload = function() { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); const s = 300/img.width; c.width = 300; c.height = img.height * s; ctx.drawImage(img, 0, 0, c.width, c.height); publishMessage(c.toDataURL('image/jpeg', 0.6), 'image', caption); cancelImagePreview(); }
}
function handleTyping() { if(client && client.connected) client.publish(myRoom, JSON.stringify({ type: 'typing', user: myName })); const el = document.getElementById('msg-input'); el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
function showTyping(user) { if (user === myName) return; const ind = document.getElementById('typing-indicator'); ind.innerText = `${user} typing...`; clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { ind.innerText = ""; }, 2000); }

function openLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox-overlay').style.display = 'flex'; }
function closeLightbox(e) { if (e.target.classList.contains('lightbox-close') || e.target.id === 'lightbox-overlay') { document.getElementById('lightbox-overlay').style.display = 'none'; } }

function displaySingleMessage(data) {
    const chatBox = document.getElementById('messages'); const div = document.createElement('div'); const isMe = data.user === myName;
    if (data.id) div.id = data.id;
    if ((Date.now() - data.timestamp) < 3000 && !isMe && data.type !== 'system') { if (isSoundOn) { notifAudio.currentTime=0; notifAudio.play().catch(()=>{}); } }

    if (data.type === 'system') { 
        div.style.textAlign='center'; div.style.fontSize='11px'; div.style.color='#fff'; div.style.opacity='0.7'; div.style.margin='10px 0'; 
        div.innerText=`${data.user} ${data.content}`; 
    } 
    else if (data.type === 'admin') {
        // UI ADMIN BARU: NAMA "AKSARA" + BADGE EMAS DI KANAN
        div.className = 'message admin';
        div.innerHTML = `
            <div class="admin-badge">
                AKSARA <i class="material-icons" style="font-size:16px; color:#FFD700; margin-left:4px;">verified</i>
            </div>
            <div class="admin-content">${data.content.replace(/\n/g,'<br>')}</div>
            <div class="admin-time">${data.time}</div>
        `;
    }
    else {
        div.className = isMe ? 'message right' : 'message left';
        let contentHtml = "";
        if (data.type === 'text') contentHtml = `<span class="msg-content">${data.content}</span>`;
        else if (data.type === 'image') contentHtml = `<img src="${data.content}" class="chat-image" onclick="openLightbox(this.src)">` + (data.caption ? `<div style="font-size:12px;margin-top:5px">${data.caption}</div>` : '');
        else if (data.type === 'audio') contentHtml = `<audio controls src="${data.content}"></audio>`;

        let replyHtml = data.reply ? `<div class="reply-quote" onclick="scrollToMessage('${data.reply.id}')"><div class="reply-content"><b>${data.reply.user}</b><span>${data.reply.text.substring(0,40)}...</span></div></div>` : '';
        const replyBtn = !isMe ? `<i class="material-icons reply-btn" onclick="setReply('${data.id||'unknown'}', '${data.user}', '${data.type==='text'?data.content.replace(/'/g,""):data.type}')">reply</i>` : '';

        div.innerHTML = `<span class="sender-name">${data.user}</span>${replyHtml}<div>${contentHtml}</div><div class="time-info">${data.time} ${replyBtn}</div>`;
    }
    chatBox.appendChild(div);
    const isAtBottom = (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight) < 150;
    if (isAtBottom || isMe || data.type === 'admin') chatBox.scrollTop = chatBox.scrollHeight;
}
function leaveRoom() { if(confirm("Keluar?")) { publishMessage("telah keluar.", 'system'); clearChatHistory(); localStorage.removeItem('aksara_name'); localStorage.removeItem('aksara_room'); location.reload(); } }
