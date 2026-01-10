const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// JWT Gizli Anahtar
const JWT_GIZLI_ANAHTAR = process.env.JWT_GIZLI_ANAHTAR || 'discord_turk_gizli_key_2024';

// Dosya yükleme için multer ayarı
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Sadece resim dosyaları yüklenebilir!'));
    }
});

// Veri yapıları
const kullanicilar = {};            // { username: { password, email } }
const arkadasListeleri = {};        // { username: [friend1, friend2] }
const arkadasIstekleri = {};        // { username: [requests...] }
const mesajlar = {};                // { username: [messages] }
const kullaniciProfilleri = {};     // { username: { avatar, durum, bio, online } }
const sunucular = {};               // { serverId: { name, owner, members, channels } }
const aktifKullanicilar = {};       // { socketId: username }

// Varsayılan avatar renkleri
const avatarRenkleri = [
    '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', 
    '#118AB2', '#EF476F', '#7209B7', '#3A86FF',
    '#FB5607', '#8338EC', '#FF006E', '#8AC926'
];

// Varsayılan profil oluştur
function varsayilanProfilOlustur(kullaniciAdi) {
    const renkIndex = kullaniciAdi.length % avatarRenkleri.length;
    const avatarURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(kullaniciAdi)}&background=${avatarRenkleri[renkIndex].replace('#', '')}&color=fff&bold=true&size=256`;
    
    return {
        avatar: avatarURL,
        durum: 'Çevrimiçi',
        bio: 'Merhaba! Discord Türk kullanıcısıyım.',
        online: true,
        tema: 'koyu',
        kayitTarihi: new Date().toISOString()
    };
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(express.static(__dirname));

// API Routes
app.post('/api/kayit', async (req, res) => {
    try {
        const { kullaniciAdi, sifre, email } = req.body;
        
        if (!kullaniciAdi || !sifre) {
            return res.status(400).json({ basarili: false, hata: 'Kullanıcı adı ve şifre gereklidir' });
        }
        
        if (kullanicilar[kullaniciAdi]) {
            return res.status(400).json({ basarili: false, hata: 'Bu kullanıcı adı zaten kullanılıyor' });
        }
        
        // Şifreyi hash'le
        const sifrelenmisSifre = await bcrypt.hash(sifre, 10);
        kullanicilar[kullaniciAdi] = { 
            kullaniciAdi, 
            sifre: sifrelenmisSifre,
            email: email || '',
            kayitTarihi: new Date().toISOString()
        };
        
        // Varsayılan profil oluştur
        kullaniciProfilleri[kullaniciAdi] = varsayilanProfilOlustur(kullaniciAdi);
        arkadasListeleri[kullaniciAdi] = [];
        arkadasIstekleri[kullaniciAdi] = [];
        mesajlar[kullaniciAdi] = [];
        
        console.log(`✅ Yeni kayıt: ${kullaniciAdi}`);
        res.json({ 
            basarili: true, 
            mesaj: 'Kayıt başarılı! Giriş yapabilirsiniz.',
            kullaniciAdi 
        });
    } catch (error) {
        console.error('❌ Kayıt hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

app.post('/api/giris', async (req, res) => {
    try {
        const { kullaniciAdi, sifre } = req.body;
        
        if (!kullaniciAdi || !sifre) {
            return res.status(400).json({ basarili: false, hata: 'Kullanıcı adı ve şifre gereklidir' });
        }
        
        const kullanici = kullanicilar[kullaniciAdi];
        
        if (!kullanici) {
            return res.status(401).json({ basarili: false, hata: 'Kullanıcı adı veya şifre hatalı' });
        }
        
        const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
        
        if (!sifreDogruMu) {
            return res.status(401).json({ basarili: false, hata: 'Kullanıcı adı veya şifre hatalı' });
        }
        
        // JWT Token oluştur
        const token = jwt.sign(
            { 
                kullaniciAdi: kullanici.kullaniciAdi,
                tarih: new Date().toISOString()
            }, 
            JWT_GIZLI_ANAHTAR,
            { expiresIn: '30d' }
        );
        
        // Profili güncelle
        if (kullaniciProfilleri[kullaniciAdi]) {
            kullaniciProfilleri[kullaniciAdi].online = true;
            kullaniciProfilleri[kullaniciAdi].sonGiris = new Date().toISOString();
        }
        
        res.json({ 
            basarili: true,
            token: token,
            kullaniciAdi: kullanici.kullaniciAdi,
            profil: kullaniciProfilleri[kullaniciAdi]
        });
    } catch (error) {
        console.error('❌ Giriş hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

app.post('/api/profil/guncelle', upload.single('avatar'), (req, res) => {
    try {
        const { token, durum, bio, tema } = req.body;
        const avatarDosya = req.file;
        
        // Token doğrula
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        } catch (error) {
            return res.status(401).json({ basarili: false, hata: 'Geçersiz token' });
        }
        
        const kullaniciAdi = decoded.kullaniciAdi;
        
        if (!kullaniciProfilleri[kullaniciAdi]) {
            kullaniciProfilleri[kullaniciAdi] = varsayilanProfilOlustur(kullaniciAdi);
        }
        
        // Profili güncelle
        if (durum !== undefined) kullaniciProfilleri[kullaniciAdi].durum = durum;
        if (bio !== undefined) kullaniciProfilleri[kullaniciAdi].bio = bio;
        if (tema !== undefined) kullaniciProfilleri[kullaniciAdi].tema = tema;
        
        // Avatar yüklendiyse
        if (avatarDosya) {
            const avatarURL = `/uploads/${avatarDosya.filename}`;
            kullaniciProfilleri[kullaniciAdi].avatar = avatarURL;
            kullaniciProfilleri[kullaniciAdi].avatarTipi = 'yuklenen';
        }
        
        // Tüm kullanıcılara profil güncellemesini bildir
        io.emit('profil_guncellendi', {
            kullaniciAdi: kullaniciAdi,
            profil: kullaniciProfilleri[kullaniciAdi]
        });
        
        res.json({ 
            basarili: true, 
            mesaj: 'Profil güncellendi',
            profil: kullaniciProfilleri[kullaniciAdi]
        });
    } catch (error) {
        console.error('❌ Profil güncelleme hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

app.get('/api/profil/:kullaniciAdi', (req, res) => {
    try {
        const { kullaniciAdi } = req.params;
        
        if (!kullaniciProfilleri[kullaniciAdi]) {
            kullaniciProfilleri[kullaniciAdi] = varsayilanProfilOlustur(kullaniciAdi);
        }
        
        res.json({ 
            basarili: true,
            profil: kullaniciProfilleri[kullaniciAdi],
            arkadasSayisi: arkadasListeleri[kullaniciAdi]?.length || 0
        });
    } catch (error) {
        console.error('❌ Profil getirme hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

app.post('/api/arkadas/istek/gonder', (req, res) => {
    try {
        const { token, hedefKullanici } = req.body;
        
        // Token doğrula
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        } catch (error) {
            return res.status(401).json({ basarili: false, hata: 'Geçersiz token' });
        }
        
        const gonderen = decoded.kullaniciAdi;
        
        if (gonderen === hedefKullanici) {
            return res.status(400).json({ basarili: false, hata: 'Kendine arkadaşlık isteği gönderemezsin' });
        }
        
        if (!kullanicilar[hedefKullanici]) {
            return res.status(404).json({ basarili: false, hata: 'Kullanıcı bulunamadı' });
        }
        
        // İstek zaten gönderilmiş mi?
        if (!arkadasIstekleri[hedefKullanici]) {
            arkadasIstekleri[hedefKullanici] = [];
        }
        
        if (arkadasIstekleri[hedefKullanici].includes(gonderen)) {
            return res.status(400).json({ basarili: false, hata: 'İstek zaten gönderilmiş' });
        }
        
        // Arkadaş zaten ekli mi?
        if (arkadasListeleri[hedefKullanici]?.includes(gonderen)) {
            return res.status(400).json({ basarili: false, hata: 'Bu kullanıcı zaten arkadaşınız' });
        }
        
        // İsteği kaydet
        arkadasIstekleri[hedefKullanici].push(gonderen);
        
        // Gerçek zamanlı bildirim gönder
        io.to(hedefKullanici).emit('yeni_arkadas_istegi', {
            gonderen: gonderen,
            gonderenProfil: kullaniciProfilleri[gonderen] || varsayilanProfilOlustur(gonderen),
            tarih: new Date().toISOString()
        });
        
        console.log(`📨 Arkadaşlık isteği: ${gonderen} -> ${hedefKullanici}`);
        res.json({ 
            basarili: true, 
            mesaj: 'Arkadaşlık isteği gönderildi'
        });
    } catch (error) {
        console.error('❌ Arkadaş isteği hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

app.post('/api/arkadas/istek/kabul', (req, res) => {
    try {
        const { token, gonderen } = req.body;
        
        // Token doğrula
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        } catch (error) {
            return res.status(401).json({ basarili: false, hata: 'Geçersiz token' });
        }
        
        const alici = decoded.kullaniciAdi;
        
        // İstek var mı kontrol et
        if (!arkadasIstekleri[alici] || !arkadasIstekleri[alici].includes(gonderen)) {
            return res.status(400).json({ basarili: false, hata: 'Arkadaşlık isteği bulunamadı' });
        }
        
        // Arkadaş listelerine ekle
        if (!arkadasListeleri[alici]) arkadasListeleri[alici] = [];
        if (!arkadasListeleri[gonderen]) arkadasListeleri[gonderen] = [];
        
        arkadasListeleri[alici].push(gonderen);
        arkadasListeleri[gonderen].push(alici);
        
        // İsteği listeden çıkar
        arkadasIstekleri[alici] = arkadasIstekleri[alici].filter(user => user !== gonderen);
        
        // Gerçek zamanlı bildirim gönder
        io.to(gonderen).emit('arkadas_istegi_kabul_edildi', {
            kabulEden: alici,
            kabulEdenProfil: kullaniciProfilleri[alici] || varsayilanProfilOlustur(alici)
        });
        
        // Her iki kullanıcıya da arkadaş listesi güncellemesi gönder
        io.to(alici).emit('arkadas_listesi_guncellendi', arkadasListeleri[alici]);
        io.to(gonderen).emit('arkadas_listesi_guncellendi', arkadasListeleri[gonderen]);
        
        console.log(`✅ Arkadaşlık kabul: ${alici} <- ${gonderen}`);
        res.json({ 
            basarili: true, 
            mesaj: 'Arkadaşlık isteği kabul edildi'
        });
    } catch (error) {
        console.error('❌ Arkadaş isteği kabul hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

app.get('/api/arkadas/istekler/:token', (req, res) => {
    try {
        const { token } = req.params;
        
        // Token doğrula
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        } catch (error) {
            return res.status(401).json({ basarili: false, hata: 'Geçersiz token' });
        }
        
        const kullaniciAdi = decoded.kullaniciAdi;
        const istekler = arkadasIstekleri[kullaniciAdi] || [];
        
        // İstek gönderenlerin profillerini getir
        const detayliIstekler = istekler.map(gonderen => ({
            kullaniciAdi: gonderen,
            profil: kullaniciProfilleri[gonderen] || varsayilanProfilOlustur(gonderen)
        }));
        
        res.json({ 
            basarili: true,
            istekler: detayliIstekler
        });
    } catch (error) {
        console.error('❌ Arkadaş istekleri getirme hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

// Sunucu oluşturma
app.post('/api/sunucu/olustur', (req, res) => {
    try {
        const { token, sunucuAdi } = req.body;
        
        // Token doğrula
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        } catch (error) {
            return res.status(401).json({ basarili: false, hata: 'Geçersiz token' });
        }
        
        const sahip = decoded.kullaniciAdi;
        const sunucuId = 'server_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Sunucuyu oluştur
        sunucular[sunucuId] = {
            id: sunucuId,
            ad: sunucuAdi,
            sahip: sahip,
            uyeler: [sahip],
            kanallar: [
                { id: 'genel', ad: '👋 genel', tip: 'metin' },
                { id: 'sohbet', ad: '💬 sohbet', tip: 'metin' },
                { id: 'oyun', ad: '🎮 oyun', tip: 'metin' }
            ],
            olusturmaTarihi: new Date().toISOString(),
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(sunucuAdi)}&background=7289da&color=fff&bold=true&size=128`
        };
        
        console.log(`🏗️ Yeni sunucu: ${sunucuAdi} (${sunucuId})`);
        res.json({ 
            basarili: true, 
            mesaj: 'Sunucu oluşturuldu',
            sunucu: sunucular[sunucuId]
        });
    } catch (error) {
        console.error('❌ Sunucu oluşturma hatası:', error);
        res.status(500).json({ basarili: false, hata: 'Sunucu hatası' });
    }
});

// Socket.IO İşlemleri
io.on('connection', (socket) => {
    console.log(`🔗 Yeni bağlantı: ${socket.id}`);
    
    // Kullanıcı kimlik doğrulama
    socket.on('kimlik_dogrulama', (token) => {
        try {
            const decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
            const kullaniciAdi = decoded.kullaniciAdi;
            
            // Socket'i kullanıcıya bağla
            socket.kullaniciAdi = kullaniciAdi;
            socket.join(kullaniciAdi);
            aktifKullanicilar[socket.id] = kullaniciAdi;
            
            // Çevrimiçi durumunu güncelle
            if (kullaniciProfilleri[kullaniciAdi]) {
                kullaniciProfilleri[kullaniciAdi].online = true;
                kullaniciProfilleri[kullaniciAdi].sonAktivite = new Date().toISOString();
            }
            
            // Tüm kullanıcılara çevrimiçi durumunu bildir
            socket.broadcast.emit('kullanici_durumu_degisti', {
                kullaniciAdi: kullaniciAdi,
                online: true,
                profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi)
            });
            
            // Kullanıcıya başarılı giriş bildir
            socket.emit('kimlik_dogrulandi', { 
                basarili: true, 
                kullaniciAdi: kullaniciAdi,
                profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi),
                arkadasListesi: arkadasListeleri[kullaniciAdi] || [],
                arkadasIstekleri: arkadasIstekleri[kullaniciAdi] || []
            });
            
            // Çevrimiçi arkadaşlarına bildir
            const arkadaslar = arkadasListeleri[kullaniciAdi] || [];
            arkadaslar.forEach(arkadas => {
                io.to(arkadas).emit('arkadas_durumu_degisti', {
                    kullaniciAdi: kullaniciAdi,
                    online: true,
                    profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi)
                });
            });
            
            console.log(`✅ ${kullaniciAdi} bağlandı (${socket.id})`);
        } catch (error) {
            console.log('❌ Geçersiz token:', error.message);
            socket.emit('kimlik_dogrulandi', { 
                basarili: false, 
                hata: 'Geçersiz token. Lütfen tekrar giriş yapın.' 
            });
            socket.disconnect();
        }
    });
    
    // Mesaj gönderme
    socket.on('mesaj_gonder', (data) => {
        if (!socket.kullaniciAdi) return;
        
        const { alici, mesaj, tip = 'metin', replyTo = null } = data;
        const gonderen = socket.kullaniciAdi;
        
        const mesajObjesi = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            gonderen: gonderen,
            alici: alici,
            mesaj: mesaj,
            tip: tip,
            tarih: new Date().toISOString(),
            okundu: false,
            replyTo: replyTo,
            gonderenProfil: kullaniciProfilleri[gonderen] || varsayilanProfilOlustur(gonderen)
        };
        
        // Mesajları kaydet
        if (!mesajlar[alici]) mesajlar[alici] = [];
        if (!mesajlar[gonderen]) mesajlar[gonderen] = [];
        
        mesajlar[alici].push(mesajObjesi);
        mesajlar[gonderen].push(mesajObjesi);
        
        // Gerçek zamanlı gönder
        io.to(alici).emit('yeni_mesaj', mesajObjesi);
        socket.emit('yeni_mesaj', mesajObjesi);
        
        console.log(`💬 Mesaj: ${gonderen} -> ${alici}: ${mesaj.substring(0, 30)}...`);
    });
    
    // Sunucu mesajı gönderme
    socket.on('sunucu_mesaj_gonder', (data) => {
        if (!socket.kullaniciAdi) return;
        
        const { sunucuId, kanalId, mesaj } = data;
        const gonderen = socket.kullaniciAdi;
        
        const mesajObjesi = {
            id: 'smsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            gonderen: gonderen,
            sunucuId: sunucuId,
            kanalId: kanalId,
            mesaj: mesaj,
            tip: 'sunucu',
            tarih: new Date().toISOString(),
            gonderenProfil: kullaniciProfilleri[gonderen] || varsayilanProfilOlustur(gonderen)
        };
        
        // Sunucu mesajlarını kaydet
        if (!sunucular[sunucuId].mesajlar) sunucular[sunucuId].mesajlar = {};
        if (!sunucular[sunucuId].mesajlar[kanalId]) sunucular[sunucuId].mesajlar[kanalId] = [];
        sunucular[sunucuId].mesajlar[kanalId].push(mesajObjesi);
        
        // Sunucudaki tüm üyelere gönder
        const uyeler = sunucular[sunucuId].uyeler || [];
        uyeler.forEach(uye => {
            io.to(uye).emit('sunucu_yeni_mesaj', mesajObjesi);
        });
    });
    
    // Mesajları okundu olarak işaretle
    socket.on('mesajlari_okundu_isaretle', (data) => {
        const { gonderen } = data;
        const alici = socket.kullaniciAdi;
        
        if (mesajlar[alici]) {
            mesajlar[alici].forEach(msg => {
                if (msg.gonderen === gonderen && msg.alici === alici) {
                    msg.okundu = true;
                }
            });
        }
        
        // Gönderene okundu bilgisi gönder
        io.to(gonderen).emit('mesajlar_okundu', {
            okuyan: alici,
        
