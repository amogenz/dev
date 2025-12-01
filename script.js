document.addEventListener('DOMContentLoaded', () => {
    
    // =========================================
    // 1. VISUAL EFFECTS (SCROLL, CURSOR, PARALLAX)
    // =========================================
    
    // Scroll Reveal
    const revealElements = document.querySelectorAll('.reveal-item');
    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const revealPoint = 100;
        revealElements.forEach((reveal) => {
            if (reveal.getBoundingClientRect().top < windowHeight - revealPoint) {
                reveal.classList.add('active');
            }
        });
    };
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();

    // Custom Cursor
    const cursorDot = document.querySelector('[data-cursor-dot]');
    const cursorOutline = document.querySelector('[data-cursor-outline]');
    if (window.matchMedia("(pointer: fine)").matches) {
        window.addEventListener("mousemove", (e) => {
            cursorDot.style.left = `${e.clientX}px`;
            cursorDot.style.top = `${e.clientY}px`;
            cursorOutline.animate({ left: `${e.clientX}px`, top: `${e.clientY}px` }, { duration: 500, fill: "forwards" });
        });
    }

    // Logo Parallax
    const logo = document.querySelector('.main-logo');
    document.addEventListener('mousemove', (e) => {
        if(window.innerWidth > 768 && logo) {
            const x = (window.innerWidth - e.pageX * 2) / 90;
            const y = (window.innerHeight - e.pageY * 2) / 90;
            logo.style.transform = `translate(${x}px, ${y}px)`;
        }
    });

    // =========================================
    // 2. AMMO AI LOGIC (SERVERLESS + MEMORY)
    // =========================================
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    // [TAMBAHAN 1] Variabel untuk menyimpan ingatan chat sementara
    let conversationHistory = []; 

    // FUNGSI HELPER 1: Scroll ke bawah otomatis
    const scrollToBottom = () => {
        if(chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    // FUNGSI HELPER 2: Menampilkan pesan ke layar
    const appendMessage = (sender, text) => {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');
        msgDiv.classList.add(sender === 'user' ? 'user-msg' : 'ai-msg');
        
        if(sender === 'ai') {
            msgDiv.innerHTML = `<span class="prefix">AMMO_AI:</span> ${text}`;
        } else {
            msgDiv.textContent = text;
        }
        
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
    };

    // LOGIKA UTAMA: Kirim ke Backend Vercel
    const handleChat = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        // 1. Tampilkan Pesan User
        appendMessage('user', text);
        userInput.value = '';
        userInput.disabled = true;

        // 2. Tampilkan Loading
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'ai-msg');
        loadingDiv.innerHTML = `<span class="prefix">SYSTEM:</span> Connecting to Server...`;
        chatHistory.appendChild(loadingDiv);
        scrollToBottom();

        try {
            // 3. Tembak API Serverless Kita (/api/chat)
            const response = await fetch('/api/chat', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    message: text,
                    history: conversationHistory // [TAMBAHAN 2] Kirim ingatan ke server
                }) 
            });

            const data = await response.json();
            
            // Hapus loading
            if(chatHistory.contains(loadingDiv)) chatHistory.removeChild(loadingDiv);

            if (!response.ok) {
                throw new Error(data.error || "Gagal menghubungi server.");
            }

            // 4. Proses Jawaban AI
            let aiResponseText = "Gue bingung.";
            let rawTextForHistory = ""; // Variabel buat nyimpen teks asli

            if (data.candidates && data.candidates[0].content) {
                let rawText = data.candidates[0].content.parts[0].text;
                rawTextForHistory = rawText; // Simpan teks polos buat ingatan

                // Format HTML (Bold & Enter) untuk ditampilkan
                aiResponseText = rawText
                    .replace(/\*\*(.*?)\*\*/g, '<b style="color:#fff;">$1</b>') 
                    .replace(/\n/g, '<br>'); 
                
                // Cek apakah dia habis googling
                if (data.candidates[0].groundingMetadata?.searchEntryPoint) {
                    aiResponseText += `<br><br><small style="opacity:0.6;">[Sumber: Google Search]</small>`;
                }
            }
            appendMessage('ai', aiResponseText);

            // [TAMBAHAN 3] Simpan percakapan ini ke ingatan browser
            conversationHistory.push({ role: "user", parts: [{ text: text }] });
            conversationHistory.push({ role: "model", parts: [{ text: rawTextForHistory }] });

        } catch (error) {
            if(chatHistory.contains(loadingDiv)) chatHistory.removeChild(loadingDiv);
            appendMessage('ai', `💀 Error: ${error.message}`);
        } finally {
            userInput.disabled = false;
            userInput.focus();
        }
    };

    // Event Listeners (Tombol Kirim & Enter)
    if(sendBtn && userInput) {
        sendBtn.addEventListener('click', handleChat);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChat();
        });
    }
});
