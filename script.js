/* AKSARA CHAT SYSTEM - OPTIMIZED VERSION */

let client;
let myName = "";
let myRoom = "";
let storageTopic = ""; 
const broadcastTopic = "aksara-global-v1/announcements";

const ADMIN_HASH_KEY = "1120"; 

// State Variables
let isAdminMode = false; 
let tempImageBase64 = null; 
let mediaRecorder, audioChunks = [], isRecording = false, audioBlobData = null;
let isSoundOn = true;
let sendOnEnter = true;
let tabNotificationsOn = true; // NEW: Tab notifications setting
let replyingTo = null; 
let onlineUsers = {};
let typingTimeout;
let localChatHistory = []; 

// PERFORMANCE OPTIMIZATION VARIABLES
let saveDebounce, storageDebounce, typingThrottle = false;
let pingInterval;

// NOTIFICATION SYSTEM VARIABLES - NEW
let originalTitle = "";
let titleBlinkInterval;
let unreadCount = 0;
let isWindowFocused = true;
let audioUnlocked = false;

// Audio Elements
const notifAudio = document.getElementById('notifSound');
const sentAudio = document.getElementById('sentSound');

function customHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash += str.charCodeAt(i) * (i + 1);
    }
    return (hash * 10).toString();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = 'info';
    let color = '#007AFF';
    if (type === 'success') { icon = 'check_circle'; color = '#34C759'; }
    if (type === 'error') { icon = 'error'; color = '#ff4444'; }
    
    toast.innerHTML = `<i class="material-icons" style="color:${color}">${icon}</i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.remove(), 500); 
    }, 3000);
}

// ==================== NOTIFICATION SYSTEM ====================

function initializeNotificationSystem() {
    originalTitle = document.title;
    
    // Track window focus
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initialize browser notifications
    initializeBrowserNotifications();
}

function handleWindowFocus() {
    isWindowFocused = true;
    resetNotifications();
}

function handleWindowBlur() {
    isWindowFocused = false;
}

function handleVisibilityChange() {
    if (!document.hidden) {
        resetNotifications();
    }
}

function initializeBrowserNotifications() {
    // Request permission for browser notifications
    if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    console.log("Browser notifications enabled");
                }
            });
        }, 2000);
    }
}

function showNewMessageNotification(message) {
    if (!tabNotificationsOn) return;
    
    const isMe = message.user === myName;
    if (isMe) return; // Don't notify for own messages
    
    unreadCount++;
    
    // 1. Update tab title with blinking
    startTitleBlinking(message);
    
    // 2. Update favicon badge
    updateFaviconBadge();
    
    // 3. Play sound
    playSound('received');
    
    // 4. Browser notification (if permitted and window not focused)
    showBrowserNotification(message);
}

function startTitleBlinking(message) {
    if (titleBlinkInterval) clearInterval(titleBlinkInterval);
    
    const messagePreview = message.content.length > 30 
        ? message.content.substring(0, 30) + '...' 
        : message.content;
    
    let showAlert = true;
    
    titleBlinkInterval = setInterval(() => {
        if (showAlert) {
            document.title = `🔔 (${unreadCount}) ${message.user}: ${messagePreview}`;
        } else {
            document.title = originalTitle;
        }
        showAlert = !showAlert;
    }, 1000);
}

function updateFaviconBadge() {
    // Skip favicon modification - focus on title blinking saja
    console.log(`🔔 ${unreadCount} pesan belum dibaca`);
    
    // Kita bisa tambahkan subtle visual feedback di UI
    const header = document.querySelector('header');
    if (header && unreadCount > 0 && !isWindowFocused) {
        header.style.boxShadow = '0 0 0 2px var(--ios-red)';
    } else if (header) {
        header.style.boxShadow = '';
    }
}

function showBrowserNotification(message) {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (document.hasFocus()) return; // Don't show if tab is active
    
    const notification = new Notification(`Pesan dari ${message.user}`, {
        body: message.type === 'text' ? message.content : `Mengirim ${message.type}`,
        icon: 'https://i.imgur.com/Ct0pzwl.png',
        tag: 'aksara-chat',
        requireInteraction: false
    });
    
    notification.onclick = function() {
        window.focus();
        notification.close();
    };
    
    setTimeout(() => notification.close(), 5000);
}

function resetNotifications() {
    // Clear blinking and reset counters
    if (titleBlinkInterval) {
        clearInterval(titleBlinkInterval);
        titleBlinkInterval = null;
    }
    
    document.title = originalTitle;
    unreadCount = 0;
    
    // Reset header style juga
    const header = document.querySelector('header');
    if (header) {
        header.style.boxShadow = '';
    }
}

// ==================== SOUND SYSTEM ====================

function unlockAudio() {
    if (audioUnlocked) return;
    
    const unlock = () => {
        const silentPlay = (audio) => {
            if (!audio) return Promise.resolve();
            
            audio.volume = 0.01;
            return audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1.0;
                return true;
            }).catch(() => false);
        };
        
        Promise.all([silentPlay(notifAudio), silentPlay(sentAudio)]).then(results => {
            if (results.some(result => result)) {
                audioUnlocked = true;
                console.log("Audio unlocked successfully");
            }
        });
    };
    
    unlock();
    
    const unlockOnInteraction = () => {
        unlock();
        document.removeEventListener('click', unlockOnInteraction);
        document.removeEventListener('keydown', unlockOnInteraction);
        document.removeEventListener('touchstart', unlockOnInteraction);
    };
    
    document.addEventListener('click', unlockOnInteraction);
    document.addEventListener('keydown', unlockOnInteraction);
    document.addEventListener('touchstart', unlockOnInteraction);
}

function playSound(type) {
    if (!isSoundOn) return;
    
    const audio = (type === 'sent') ? sentAudio : notifAudio;
    if (!audio) return;
    
    audio.volume = (type === 'sent') ? 0.4 : 1.0;
    audio.currentTime = 0;
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log(`Audio play failed (${type}):`, error);
            
            try {
                const fallbackAudio = new Audio(audio.src);
                fallbackAudio.volume = audio.volume;
                fallbackAudio.play().catch(e => {
                    console.log("Fallback audio also failed:", e);
                    if (!audioUnlocked) {
                        unlockAudio();
                    }
                });
            } catch (fallbackError) {
                console.log("Fallback creation failed:", fallbackError);
            }
        });
    }
}

// ==================== ADMIN & SETTINGS ====================

function toggleAdminMode(active) {
    isAdminMode = active;
    const wrapper = document.getElementById('input-wrapper'); 
    const sendBtn = document.getElementById('send-btn');
    
    if (active) {
        if(wrapper) {
            wrapper.style.border = "1px solid #FFD700";
            wrapper.style.boxShadow = "0 0 10px rgba(255, 215, 0, 0.3)";
        }
        if(sendBtn) {
            sendBtn.style.background = '#FFD700'; 
            sendBtn.style.color = '#000';
        }
        showToast("Mode Admin AKTIF", "success");
    } else {
        if(wrapper) {
            wrapper.style.border = "1px solid rgba(255,255,255,0.5)";
            wrapper.style.boxShadow = "0 4px 15px rgba(0,0,0,0.05)";
        }
        if(sendBtn) {
            sendBtn.style.background = '#007AFF'; 
            sendBtn.style.color = '#fff';
        }
        showToast("Mode Admin NONAKTIF", "info");
    }
}

function toggleNotifSettings() {
    tabNotificationsOn = document.getElementById('notif-toggle').checked;
    localStorage.setItem('aksara_notif', tabNotificationsOn);
    showToast(`Tab notifications ${tabNotificationsOn ? 'diaktifkan' : 'dinonaktifkan'}`, "info");
}

// ==================== PERFORMANCE OPTIMIZED FUNCTIONS ====================

function debouncedSaveToLocal() {
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => saveToLocal(), 1000);
}

function debouncedUpdateServerStorage() {
    clearTimeout(storageDebounce);
    storageDebounce = setTimeout(() => updateServerStorage(), 5000);
}

function addSingleMessage(data) {
    const chatBox = document.getElementById('messages');
    const newMsg = createMessageElement(data);
    chatBox.appendChild(newMsg);
    scrollToBottom(true);
}

function handleTyping() {
    const el = document.getElementById('msg-input');
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
    
    if (!typingThrottle && client && client.connected) {
        typingThrottle = true;
        client.publish(myRoom, JSON.stringify({type:'typing', user:myName}));
        
        setTimeout(() => {
            typingThrottle = false;
        }, 1000);
    }
}

// ==================== INITIALIZATION ====================

window.onload = function() {
    if(localStorage.getItem('aksara_name')) document.getElementById('username').value = localStorage.getItem('aksara_name');
    if(localStorage.getItem('aksara_room')) document.getElementById('room').value = localStorage.getItem('aksara_room');
    
    isSoundOn = (localStorage.getItem('aksara_sound') === 'true');
    sendOnEnter = (localStorage.getItem('aksara_enter') === 'true');
    tabNotificationsOn = (localStorage.getItem('aksara_notif') !== 'false'); // Default true
    
    const toggleS = document.getElementById('sound-toggle');
    if(toggleS) toggleS.checked = isSoundOn;
    
    const toggleE = document.getElementById('enter-toggle');
    if(toggleE) toggleE.checked = sendOnEnter;

    const toggleN = document.getElementById('notif-toggle');
    if(toggleN) toggleN.checked = tabNotificationsOn;

    const savedBg = localStorage.getItem('aksara_bg_image');
    if(savedBg) document.body.style.backgroundImage = `url(${savedBg})`;
    
    initializeNotificationSystem();
    setTimeout(unlockAudio, 1000);
};

// ==================== CHAT SYSTEM ====================

function startChat() {
    const user = document.getElementById('username').value.trim();
    const room = document.getElementById('room').value.trim().toLowerCase();
    if (!user || !room) { showToast("Lengkapi data!", "error"); return; }

    localStorage.setItem('aksara_name', user);
    localStorage.setItem('aksara_room', room);
    
    myName = user;
    myRoom = "aksara-v29/" + room; 
    storageTopic = myRoom + "/storage"; 

    document.getElementById('side-user').innerText = myName;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    document.getElementById('room-display').innerText = "#" + room;
    document.getElementById('typing-indicator').innerText = "Menghubungkan...";

    loadFromLocal(); 

    const options = { 
        protocol: 'wss', type: 'mqtt', clean: true, 
        reconnectPeriod: 1000, 
        clientId: 'aks_' + Math.random().toString(16).substr(2, 8) 
    };
    client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', options);

    client.on('connect', () => {
        document.getElementById('typing-indicator').innerText = "";
        client.subscribe(myRoom); 
        client.subscribe(storageTopic);
        client.subscribe(broadcastTopic); 
        
        publishMessage("bergabung.", 'system');
        
        pingInterval = setInterval(() => { 
            if (client && client.connected) {
                client.publish(myRoom, JSON.stringify({ type: 'ping', user: myName })); 
                cleanOnlineList(); 
            }
        }, 30000);
    });

    client.on('message', (topic, message) => {
        const msgString = message.toString();
        
        if (topic === broadcastTopic) {
            try {
                const data = JSON.parse(msgString);
                if (data.type === 'admin_clear') {
                    localChatHistory = localChatHistory.filter(msg => !msg.isAdmin && msg.type !== 'admin');
                    debouncedSaveToLocal();
                    renderChat();
                    showToast("Pengumuman Admin Ditarik", "info");
                } else {
                    handleIncomingMessage(data); 
                }
            } catch(e) {}
            return;
        }

        if (topic === storageTopic) { 
            try { 
                const srv = JSON.parse(msgString); 
                if (Array.isArray(srv)) mergeWithLocal(srv); 
            } catch(e) {} 
            return; 
        }
        
        if (topic === myRoom) { 
            try { 
                const data = JSON.parse(msgString); 
                if (data.type === 'ping') { updateOnlineList(data.user); return; } 
                if (data.type === 'typing') { showTyping(data.user); return; } 
                handleIncomingMessage(data); 
            } catch(e) {} 
        }
    });

    client.on('offline', () => {
        showToast("Koneksi terputus...", "error");
    });

    client.on('reconnect', () => {
        showToast("Menghubungkan kembali...", "info");
    });
}

function handleIncomingMessage(data) {
    const isSystem = (data.type === 'system' || data.type === 'admin_clear');
    const isMe = data.user === myName;
    
    if (!isSystem) {
        if (!localChatHistory.some(msg => msg.id === data.id)) {
            localChatHistory.push(data);
            if (localChatHistory.length > 77) localChatHistory = localChatHistory.slice(-77); 
            
            addSingleMessage(data);
            debouncedSaveToLocal();
            
            if (!isMe) {
                playSound('received');
                showNewMessageNotification(data); // NEW: Trigger notifications
            }
            if (isMe && !data.isAdmin) {
                debouncedUpdateServerStorage();
            }
        }
    } else {
        renderSingleElement(data);
    }
}

function renderChat(forceScroll = false) {
    const chatBox = document.getElementById('messages');
    if (chatBox.children.length === 0 || forceScroll) {
        chatBox.innerHTML = '<div class="welcome-msg">Messages are encrypted and secure.</div>';
        localChatHistory.forEach(msg => { 
            chatBox.appendChild(createMessageElement(msg)); 
        });
    }
    scrollToBottom(forceScroll);
}

function renderSingleElement(data) {
    const chatBox = document.getElementById('messages');
    chatBox.appendChild(createMessageElement(data));
    scrollToBottom(false);
}

function createMessageElement(data) {
    const div = document.createElement('div');
    const isMe = data.user === myName;
    if (data.id) div.id = data.id;
    if (data.type === 'system') {
        div.style.textAlign = 'center'; div.style.fontSize = '11px'; 
        div.style.color = '#fff'; div.style.opacity = '0.7'; div.style.margin = '10px 0'; 
        div.innerText = `${data.user} ${data.content}`;
        return div;
    }

    if (data.isAdmin || data.type === 'admin') {
        div.className = 'message admin';
        let contentHtml = "";
        if (data.type === 'image') {
            contentHtml = `<img src="${data.content}" class="chat-image" onclick="openLightbox(this.src)" style="max-height:200px; width:auto;">` + (data.caption ? `<div style="font-size:12px;margin-top:5px;color:#fff">${data.caption}</div>` : '');
        } else if (data.type === 'audio') {
            contentHtml = `<audio controls src="${data.content}" style="width:100%; margin-top:5px;"></audio>`;
        } else {
            contentHtml = data.content.replace(/\n/g, '<br>');
        }
        div.innerHTML = `<div class="admin-badge">AKSARA <i class="material-icons" style="font-size:16px; color:#FFD700; margin-left:4px;">verified</i></div><div class="admin-content">${contentHtml}</div><div class="admin-time">${data.time}</div>`;
        return div;
    }

    div.className = isMe ? 'message right' : 'message left';
    let contentHtml = "";
    if (data.type === 'text') contentHtml = `<span class="msg-content">${data.content}</span>`;
    else if (data.type === 'image') contentHtml = `<img src="${data.content}" class="chat-image" onclick="openLightbox(this.src)" style="max-height:200px; width:auto;">` + (data.caption ? `<div style="font-size:12px;margin-top:5px">${data.caption}</div>` : '');
    else if (data.type === 'audio') contentHtml = `<audio controls src="${data.content}"></audio>`;

    let replyHtml = "";
    if (data.reply) {
        replyHtml = `<div class="reply-quote" onclick="scrollToMessage('${data.reply.id}')"><div class="reply-content"><b>${data.reply.user}</b><span>${data.reply.text.substring(0, 40)}...</span></div></div>`;
    }

    const replyBtn = !isMe ? `<i class="material-icons reply-btn" onclick="setReply('${data.id||'unknown'}', '${data.user}', '${data.type==='text'?data.content.replace(/'/g,""):data.type}')">reply</i>` : '';

    div.innerHTML = `<span class="sender-name">${data.user}</span>${replyHtml}<div>${contentHtml}</div><div class="time-info">${data.time} ${replyBtn}</div>`;
    return div;
}

function scrollToBottom(force = false) {
    const chatBox = document.getElementById('messages');
    const isAtBottom = (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight) < 150;
    if (force || isAtBottom) {
        setTimeout(() => {
            chatBox.scrollTop = chatBox.scrollHeight;
        }, 100);
    }
}

function publishMessage(content, type = 'text', caption = '') {
    if (!content) return;
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const msgId = 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    let finalType = type;
    let finalTopic = myRoom;
    let mqttOpts = {};

    if (isAdminMode) {
        finalTopic = broadcastTopic;
        mqttOpts = { retain: true, qos: 1 }; 
        if (type === 'text') finalType = 'admin';
    } else if (type === 'admin_clear') {
        finalTopic = broadcastTopic;
        mqttOpts = { retain: true, qos: 1 };
    }

    const payload = { 
        id: msgId, user: myName, content: content, type: finalType, 
        caption: caption, time: time, reply: replyingTo, timestamp: Date.now(),
        isAdmin: isAdminMode 
    };

    try { 
        client.publish(finalTopic, JSON.stringify(payload), mqttOpts); 
        if (isSoundOn && !isAdminMode && type !== 'system') playSound('sent');
    } catch(e) { showToast("Gagal kirim", "error"); }
    
    if (!isAdminMode) cancelReply();
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    if (text.startsWith('/admin ')) {
        const pass = text.split(' ')[1];
        if (customHash(pass) === ADMIN_HASH_KEY) {
            toggleAdminMode(true);
        } else {
            showToast("Password Salah!", "error");
        }
        input.value = ''; input.style.height = 'auto'; input.focus(); return;
    }

    if (text === '/exit') { toggleAdminMode(false); input.value = ''; input.style.height = 'auto'; input.focus(); return; }
    
    if (text.startsWith('/hapusadmin')) {
        const pass = text.split(' ')[1];
        if (customHash(pass) === ADMIN_HASH_KEY) {
            publishMessage('clear', 'admin_clear');
            showToast("Dihapus", "success");
        } else {
            showToast("Password Salah!", "error");
        }
        input.value = ''; return;
    }

    publishMessage(text, 'text');
    input.value = ''; input.style.height = 'auto'; input.focus();
}

// ==================== UTILITY FUNCTIONS ====================

function handleEnter(e) { if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) { e.preventDefault(); sendMessage(); } }
function showTyping(user) { if(user===myName)return; const ind=document.getElementById('typing-indicator'); ind.innerText=`${user} typing...`; clearTimeout(typingTimeout); typingTimeout=setTimeout(()=>{ind.innerText="";},2000); }
function updateOnlineList(user) { onlineUsers[user]=Date.now(); renderOnlineList(); }
function cleanOnlineList() { const now=Date.now(); for(const u in onlineUsers)if(now-onlineUsers[u]>40000)delete onlineUsers[u]; renderOnlineList(); }
function renderOnlineList() { const l=document.getElementById('online-list'); const c=document.getElementById('online-count'); l.innerHTML=""; let count=0; for(const u in onlineUsers){ const li=document.createElement('li'); li.innerHTML=`<span style="color:var(--ios-green)">●</span> ${u}`; l.appendChild(li); count++; } if(c)c.innerText=count; }

function toggleSidebar() { const sb=document.getElementById('sidebar'); const ov=document.getElementById('sidebar-overlay'); if(sb.style.left==='0px'){sb.style.left='-350px';sb.classList.remove('active');ov.style.display='none';}else{sb.style.left='0px';sb.classList.add('active');ov.style.display='block';} }
function handleBackgroundUpload(input) { const f=input.files[0]; if(f){ const r=new FileReader(); r.onload=e=>{try{localStorage.setItem('aksara_bg_image',e.target.result); document.body.style.backgroundImage=`url(${e.target.result})`; showToast("Background diganti","success");}catch(e){showToast("Gambar kebesaran","error");}}; r.readAsDataURL(f); } }
function resetBackground() { localStorage.removeItem('aksara_bg_image'); document.body.style.backgroundImage=""; showToast("Background reset","info"); }
function toggleSound() { isSoundOn=document.getElementById('sound-toggle').checked; localStorage.setItem('aksara_sound',isSoundOn); }
function toggleEnterSettings() { sendOnEnter=document.getElementById('enter-toggle').checked; localStorage.setItem('aksara_enter',sendOnEnter); }

function loadFromLocal() { const saved = localStorage.getItem(getStorageKey()); if (saved) { localChatHistory = JSON.parse(saved); renderChat(); } }
function saveToLocal() { localStorage.setItem(getStorageKey(), JSON.stringify(localChatHistory)); }
function getStorageKey() { return 'aksara_history_v29_' + myRoom; }
function updateServerStorage() { if(client && client.connected) client.publish(storageTopic, JSON.stringify(localChatHistory), { retain: true, qos: 1 }); }
function mergeWithLocal(serverData) { let changed = false; serverData.forEach(srvMsg => { if (!localChatHistory.some(locMsg => locMsg.id === srvMsg.id)) { localChatHistory.push(srvMsg); changed = true; } }); if (changed) { localChatHistory.sort((a, b) => a.timestamp - b.timestamp); if (localChatHistory.length > 77) localChatHistory = localChatHistory.slice(-77); debouncedSaveToLocal(); renderChat(); } }

// MEDIA HANDLERS
function triggerImageUpload() { document.getElementById('chat-file-input').click(); }
function handleImageUpload(input) { 
    const f = input.files[0]; 
    if(f){ const r=new FileReader(); r.onload=e=>{ tempImageBase64 = e.target.result; document.getElementById('preview-img').src=tempImageBase64; document.getElementById('image-preview-modal').style.display='flex'; }; r.readAsDataURL(f); } input.value=""; 
}
function cancelImagePreview() { document.getElementById('image-preview-modal').style.display='none'; document.getElementById('img-caption').value=""; tempImageBase64=null; }
function sendImageWithCaption() {
    if(!tempImageBase64) return;
    const caption = document.getElementById('img-caption').value.trim(); 
    const img = new Image(); 
    img.src = tempImageBase64;
    img.onload = function() { 
        requestAnimationFrame(() => {
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            const s = 300/img.width;
            c.width = 300;
            c.height = img.height * s;
            ctx.drawImage(img, 0, 0, c.width, c.height); 
            publishMessage(c.toDataURL('image/jpeg', 0.6), 'image', caption); 
            cancelImagePreview(); 
        });
    }
}
function sendVoiceNote() { const r = new FileReader(); r.readAsDataURL(audioBlobData); r.onloadend = () => { publishMessage(r.result, 'audio'); cancelVoiceNote(); }; }
function cancelVoiceNote() { audioBlobData = null; document.getElementById('vn-preview-bar').style.display = 'none'; document.getElementById('main-input-area').style.display = 'flex'; }
function setReply(id, user, text) { replyingTo = { id, user, text }; document.getElementById('reply-preview-bar').style.display = 'flex'; document.getElementById('reply-to-user').innerText = user; document.getElementById('reply-preview-text').innerText = text.substring(0,50)+'...'; document.getElementById('msg-input').focus(); }
function cancelReply() { replyingTo = null; document.getElementById('reply-preview-bar').style.display = 'none'; }
function scrollToMessage(msgId) { const el = document.getElementById(msgId); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash-highlight'); setTimeout(() => el.classList.remove('flash-highlight'), 1000); } else { showToast("Pesan tidak ditemukan.", "info"); } }
function openLightbox(src) { document.getElementById('lightbox-img').src = src; document.getElementById('lightbox-overlay').style.display = 'flex'; }
function closeLightbox(e) { if (e.target.classList.contains('lightbox-close') || e.target.id === 'lightbox-overlay') { document.getElementById('lightbox-overlay').style.display = 'none'; } }

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

function leaveRoom() { 
    if(confirm("Keluar?")) { 
        if (pingInterval) clearInterval(pingInterval);
        if (titleBlinkInterval) clearInterval(titleBlinkInterval);
        publishMessage("telah keluar.", 'system'); 
        setTimeout(() => {
            localStorage.removeItem('aksara_name'); 
            localStorage.removeItem('aksara_room'); 
            location.reload(); 
        }, 1000);
    } 
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (pingInterval) clearInterval(pingInterval);
    if (titleBlinkInterval) clearInterval(titleBlinkInterval);
    if (client) client.end();
});