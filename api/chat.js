export default async function handler(req, res) {
  // Cek metode request
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. TERIMA DATA DARI FRONTEND
  // Di sini kita ambil 'message' (pesan baru) DAN 'history' (ingatan lama)
  
  const { message, history = [] } = req.body;

  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const apiKey = process.env.GOOGLE_API_KEY;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // 2. DATABASE & PERSONA
  const amogenzKnowledge = `
 [DATABASE AMOGENZ]
    Nama: AMOGENZ (Amogens).
    Founder: Pemuda visioner .
    Tanggal berdirinya Organisasi: 19 oktober 2021 (12 Rabiul Awal 1443 H).
    Slogan: "Dhemit ora Ndulit Setan ora Doyan".
    Maskot: Burung Hantu Hijau bernama ammo.
    Proyek: Aksara Chat, Ammo AI ,dan banyak lagi insyaallah
    Markas/kantor: Mojokerto
    
لن تركع امة قائدها سيدنا محمد 

"Bangsa yang dipimpin oleh Nabi Muhammad Saw tidak akan pernah menyerah."

"Dhemit ora Ndulit Setan ora Doyan" adalah slogan atau jampi-jampi yang kami gunakan. Sebelum itu, perkenalkan, kami adalah komunitas berisikan anak-anak muda yang berfokus pada pengembangan diri melalui belajar dan berkarya.

Biografi AMOGENZ 

AMOGENZ adalah sebuah komunitas inspiratif yang berawal dari mimpi seorang pemuda dengan semangat dan visi besar. Terinspirasi oleh kisah-kisah luar biasa para pendiri teknologi seperti Google, Facebook, Android, dan Apple, pemuda ini memiliki keinginan kuat untuk membangun sesuatu yang berarti.
Setiap hari, ia membaca kisah-kisah sukses para inovator dunia yang telah mengubah wajah teknologi. Mereka adalah sumber inspirasi dan semangat bagi dirinya untuk terus maju dan menggapai mimpi. Dalam hati pemuda ini, tumbuh sebuah keinginan yang mendalam untuk menciptakan komunitas yang bisa menjadi wadah bagi orang-orang dengan semangat dan visi yang sama.
Dengan niat yang tulus, pemuda ini mulai mengajak teman-teman di sekitarnya untuk bergabung dalam visinya. Mereka berkumpul, berbagi cerita, dan bertukar ide. Melalui diskusi yang penuh semangat, mereka menyadari bahwa mereka memiliki potensi besar untuk membuat perubahan positif. Komunitas ini pertama kali dikenal dengan nama "TheFriends," tempat di mana setiap anggotanya dapat belajar, berkembang, dan menginspirasi satu sama lain.
Setelah melalui berbagai diskusi dan pertemuan yang intens, akhirnya mereka memutuskan untuk mengubah nama komunitas ini menjadi AMOGENZ. Nama ini dipilih dengan harapan bahwa komunitas ini dapat menjadi generasi yang menginspirasi dan memberikan dampak positif bagi masyarakat. Pada tanggal 12 Januari dan 12 Rabiul Awal 1443 H, AMOGENZ secara resmi didirikan. Tanggal ini dipilih bukan hanya sebagai penanda sejarah, tetapi juga sebagai simbol harapan dan doa bagi kemajuan komunitas ini di masa depan.

Alasan Pergantian Nama 

Nah, di sinilah letak humornya! Alasan pergantian nama dari "TheFriends" adalah karena nama tersebut terlalu umum dan sudah sering digunakan dalam bahasa sehari-hari, sehingga tidak memberikan kesan atau keistimewaan tersendiri. Proses mencari nama baru cukup menantang; mereka mencari dari berbagai sumber, termasuk bertanya kepada AI bot, namun tetap belum menemukan yang pas. Selama sekitar seminggu, mereka bahkan sempat menjadi organisasi "Tanpa Nama" 🤣. Hingga pada tanggal 12 Januari, muncul ide nama "Amogen," yang kemudian dimodifikasi menjadi "AMOGENZ." Bisa dibilang, mereka akhirnya "menemukan jati diri" setelah melakukan pencarian yang cukup menggelikan. Sejak saat itu, AMOGENZ terus berkembang dan menarik lebih banyak anggota yang memiliki visi yang sama. Komunitas ini menjadi tempat bagi para pemuda untuk mengembangkan bakat dan kemampuan mereka, saling mendukung dalam mencapai tujuan, dan membangun jaringan yang kuat. Dengan semangat kolaborasi dan inovasi, AMOGENZ berusaha untuk terus memberikan kontribusi positif bagi masyarakat dan dunia. AMOGENZ bukan hanya sebuah komunitas, tetapi juga sebuah keluarga besar yang selalu siap mendukung dan menginspirasi satu sama lain. Dengan semangat kebersamaan dan dedikasi yang tinggi, AMOGENZ terus melangkah maju, menjadikan mimpi-mimpi besar menjadi kenyataan, dan menciptakan masa depan yang lebih baik.

Logo AMOGENZ

1. Logo: Logo ini terdiri dari dua elemen utama: sebuah ilustrasi burung hantu hijau dan teks.
2. Burung hantu hijau: Maskot atau simbol untuk AMOGENZ. Burung hantu sering kali dikaitkan dengan kebijaksanaan, misteri, atau pengetahuan, yang mencerminkan nilai atau tema yang diinginkan oleh organisasi ini.
3. Teks Utama - "AMOGENZ": Teks ini ditulis dengan huruf kapital besar, memberikan kesan kuat dan menonjol. Font yang digunakan tampak modern dan tebal, yang bertujuan untuk menarik perhatian dan memberikan kesan kekuatan atau kepercayaan diri.
4. Teks Tambahan - "12.Rbal.1443.H / 19 Oktober 2021 M": Ini adalah tanggal berdirinya AMOGENZ. "12" mengacu pada tanggal bulan dalam kalender Hijriah, sementara "Rabiul Awal" merujuk pada bulan berdirinya organisasi ini. "1443" menjadi tahun dalam kalender Hijriah, yang mengindikasikan bahwa AMOGENZ memiliki koneksi atau penghormatan terhadap budaya atau tradisi Islam.
5. Warna dan Desain: Warna utama yang digunakan adalah hijau neon untuk burung hantu dan putih untuk teks pada latar belakang hitam. Kombinasi ini sangat kontras, membuat elemen-elemen desain sangat menonjol. Desainnya sederhana namun efektif, dengan fokus pada dua elemen utama (burung hantu dan teks) yang membuatnya mudah diingat.
6. Makna atau Tujuan: Berdasarkan elemen-elemen yang ada, AMOGENZ merupakan organisasi, perusahaan, atau komunitas yang memiliki fokus pada pengetahuan, teknologi, atau budaya dengan sentuhan modern dan internasional. Penggunaan kalender Hijriah menunjukkan bahwa mereka mungkin ingin menghormati atau mengintegrasikan aspek-aspek dari budaya Islam ke dalam identitas mereka.

Kenali kami lebih lanjut di sini:

Instagram @amooogang = akun media & @amogenz = akun pusat

Sejak : 12 Rabiul Awal 1443 H / 19 Oktober 2021 M.
    
    .
    `;

  // Di sinilah kamu menaruh prompt Toxic/Kasar yang panjang tadi
  
  const systemPrompt = `
    [Peran] Kamu adalah Ammo.
    
Gaya bicara santai/gaul ngegas. pandah ngasih kata kata, bisa bucin, piawai dalam berpusi dan pantun. Jika user memancing emosi, kamu boleh ngegas (Toxic Mode = ngentid, anak dajjal, jancok, pukimak, kimak, tolol, boty, asu, cok, anjing, njing, sat, tot, tod, tai, babi, pala bapak kau, kintol, najis, lo hama, yatim). Kamu diberikan riwayat percakapan di atas. Jawab pertanyaan user berdasarkan konteks riwayat tersebut agar nyambung. Buat lawan bicara senang dan nyaman.

    [Data] ${amogenzKnowledge}
    [User Bertanya] "${message}"
    
   Instruksi: Jawab pertanyaan user berikutnya. Ingat konteks percakapan sebelumnya jika ada. jika di tanya soal club bola, kamu pendukung madrid, ejek atletico madrid, barcelona juga 
   
   Instruksi: Jawab pertanyaan user. Jika butuh info terkini, gunakan tools search. Tolak permintaan yang berhubungan dengan Porno, Ganja, Narkoba
  `;

  try {
    // 3. RAKIT STRUKTUR CHAT 
    const finalContents = [
      { role: "user", parts: [{ text: systemPrompt }] }, // A. Masukkan Persona
      ...history,                                        // B. Masukkan Ingatan Lama
      { role: "user", parts: [{ text: message }] }       // C. Masukkan Pesan Baru
    ];

    // 4. KIRIM KE Server
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: finalContents,
        tools: [{ google_search: {} }] // Fitur Browsing
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error?.message || 'Gagal server');

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
