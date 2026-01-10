const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// JWT Gizli Anahtar
const JWT_GIZLI_ANAHTAR = process.env.JWT_GIZLI_ANAHTAR || 'discord_turk_default_key';

// Varsayılan avatar renkleri
const avatarRenkleri = [
    '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', 
    '#118AB2', '#EF476F', '#7209B7', '#3A86FF'
];

// Veri yapıları (RAM'de tutuluyor)
const kullanicilar = {};
const arkadasListeleri = {};
const arkadasIstekleri = {};
const mesajlar = {};
const kullaniciProfilleri = {};
const aktifKullanicilar = {};

// Varsayılan profil oluştur
function varsayilanProfilOlustur(kullaniciAdi) {
    const renkIndex = kullaniciAdi.length % avatarRenkleri.length;
    const avatarURL = `/default-avatar.png`; // Lokal dosya kullan
    
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
app.use(express.static(__dirname));

// API Routes
app.post('/api/kayit', async (req, res) => {
    try {
        const { kullaniciAdi, sifre } = req.body;
        
        if (!kullaniciAdi || !sifre) {
            return res.status(400).json({ basarili: false, hata: 'Kullanıcı adı ve şifre gereklidir' });
        }
        
        if (kullanicilar[kullaniciAdi]) {
            return res.status(400).json({ basarili: false, hata: 'Bu kullanıcı adı zaten kullanılıyor' });
        }
        
        if (kullaniciAdi.length < 3) {
            return res.status(400).json({ basarili: false, hata: 'Kullanıcı adı en az 3 karakter olmalı' });
        }
        
        if (sifre.length < 4) {
            return res.status(400).json({ basarili: false, hata: 'Şifre en az 4 karakter olmalı' });
        }
        
        const sifrelenmisSifre = await bcrypt.hash(sifre, 10);
        kullanicilar[kullaniciAdi] = { 
            kullaniciAdi, 
            sifre: sifrelenmisSifre,
            kayitTarihi: new Date().toISOString()
        };
        
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
        
        const token = jwt.sign(
            { 
                kullaniciAdi: kullanici.kullaniciAdi,
                tarih: new Date().toISOString()
            }, 
            JWT_GIZLI_ANAHTAR,
            { expiresIn: '30d' }
        );
        
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

app.post('/api/profil/guncelle', (req, res) => {
    try {
        const { token, durum, bio, tema } = req.body;
        
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
        
        if (durum !== undefined) kullaniciProfilleri[kullaniciAdi].durum = durum;
        if (bio !== undefined) kullaniciProfilleri[kullaniciAdi].bio = bio;
        if (tema !== undefined) kullaniciProfilleri[kullaniciAdi].tema = tema;
        
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
        
        if (!arkadasIstekleri[hedefKullanici]) {
            arkadasIstekleri[hedefKullanici] = [];
        }
        
        if (arkadasIstekleri[hedefKullanici].includes(gonderen)) {
            return res.status(400).json({ basarili: false, hata: 'İstek zaten gönderilmiş' });
        }
        
        if (arkadasListeleri[hedefKullanici]?.includes(gonderen)) {
            return res.status(400).json({ basarili: false, hata: 'Bu kullanıcı zaten arkadaşınız' });
        }
        
        arkadasIstekleri[hedefKullanici].push(gonderen);
        
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
        
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        } catch (error) {
            return res.status(401).json({ basarili: false, hata: 'Geçersiz token' });
        }
        
        const alici = decoded.kullaniciAdi;
        
        if (!arkadasIstekleri[alici] || !arkadasIstekleri[alici].includes(gonderen)) {
            return res.status(400).json({ basarili: false, hata: 'Arkadaşlık isteği bulunamadı' });
        }
        
        if (!arkadasListeleri[alici]) arkadasListeleri[alici] = [];
        if (!arkadasListeleri[gonderen]) arkadasListeleri[gonderen] = [];
        
        arkadasListeleri[alici].push(gonderen);
        arkadasListeleri[gonderen].push(alici);
        
        arkadasIstekleri[alici] = arkadasIstekleri[alici].filter(user => user !== gonderen);
        
        io.to(gonderen).emit('arkadas_istegi_kabul_edildi', {
            kabulEden: alici,
            kabulEdenProfil: kullaniciProfilleri[alici] || varsayilanProfilOlustur(alici)
        });
        
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
        
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        } catch (error) {
            return res.status(401).json({ basarili: false, hata: 'Geçersiz token' });
        }
        
        const kullaniciAdi = decoded.kullaniciAdi;
        const istekler = arkadasIstekleri[kullaniciAdi] || [];
        
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

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Giriş sayfası
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Socket.IO
io.on('connection', (socket) => {
    console.log(`🔗 Yeni bağlantı: ${socket.id}`);
    
    socket.on('kimlik_dogrulama', (token) => {
        try {
            const decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
            const kullaniciAdi = decoded.kullaniciAdi;
            
            socket.kullaniciAdi = kullaniciAdi;
            socket.join(kullaniciAdi);
            aktifKullanicilar[socket.id] = kullaniciAdi;
            
            if (kullaniciProfilleri[kullaniciAdi]) {
                kullaniciProfilleri[kullaniciAdi].online = true;
                kullaniciProfilleri[kullaniciAdi].sonAktivite = new Date().toISOString();
            }
            
            socket.broadcast.emit('kullanici_durumu_degisti', {
                kullaniciAdi: kullaniciAdi,
                online: true,
                profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi)
            });
            
            socket.emit('kimlik_dogrulandi', { 
                basarili: true, 
                kullaniciAdi: kullaniciAdi,
                profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi),
                arkadasListesi: arkadasListeleri[kullaniciAdi] || [],
                arkadasIstekleri: arkadasIstekleri[kullaniciAdi] || []
            });
            
            const arkadaslar = arkadasListeleri[kullaniciAdi] || [];
            arkadaslar.forEach(arkadas => {
                io.to(arkadas).emit('arkadas_durumu_degisti', {
                    kullaniciAdi: kullaniciAdi,
                    online: true,
                    profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi)
                });
            });
            
            console.log(`✅ ${kullaniciAdi} bağlandı`);
        } catch (error) {
            console.log('❌ Geçersiz token:', error.message);
            socket.emit('kimlik_dogrulandi', { 
                basarili: false, 
                hata: 'Geçersiz token' 
            });
            socket.disconnect();
        }
    });
    
    socket.on('mesaj_gonder', (data) => {
        if (!socket.kullaniciAdi) return;
        
        const { alici, mesaj } = data;
        const gonderen = socket.kullaniciAdi;
        
        const mesajObjesi = {
            id: 'msg_' + Date.now(),
            gonderen: gonderen,
            alici: alici,
            mesaj: mesaj,
            tarih: new Date().toISOString(),
            okundu: false,
            gonderenProfil: kullaniciProfilleri[gonderen] || varsayilanProfilOlustur(gonderen)
        };
        
        if (!mesajlar[alici]) mesajlar[alici] = [];
        if (!mesajlar[gonderen]) mesajlar[gonderen] = [];
        
        mesajlar[alici].push(mesajObjesi);
        mesajlar[gonderen].push(mesajObjesi);
        
        io.to(alici).emit('yeni_mesaj', mesajObjesi);
        socket.emit('yeni_mesaj', mesajObjesi);
    });
    
    socket.on('arkadas_listesi_iste', () => {
        if (socket.kullaniciAdi) {
            const liste = arkadasListeleri[socket.kullaniciAdi] || [];
            const detayliListe = liste.map(arkadas => ({
                kullaniciAdi: arkadas,
                profil: kullaniciProfilleri[arkadas] || varsayilanProfilOlustur(arkadas),
                online: kullaniciProfilleri[arkadas]?.online || false
            }));
            
            socket.emit('arkadas_listesi', detayliListe);
        }
    });
    
    socket.on('mesaj_gecmisi_iste', (hedefKullanici) => {
        if (socket.kullaniciAdi) {
            const tumMesajlar = mesajlar[socket.kullaniciAdi] || [];
            const filtreli = tumMesajlar.filter(
                msg => (msg.gonderen === hedefKullanici && msg.alici === socket.kullaniciAdi) ||
                       (msg.gonderen === socket.kullaniciAdi && msg.alici === hedefKullanici)
            ).sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
            
            socket.emit('mesaj_gecmisi', filtreli);
        }
    });
    
    socket.on('disconnect', () => {
        const kullaniciAdi = socket.kullaniciAdi;
        
        if (kullaniciAdi) {
            if (kullaniciProfilleri[kullaniciAdi]) {
                kullaniciProfilleri[kullaniciAdi].online = false;
                kullaniciProfilleri[kullaniciAdi].sonCikis = new Date().toISOString();
            }
            
            delete aktifKullanicilar[socket.id];
            
            socket.broadcast.emit('kullanici_durumu_degisti', {
                kullaniciAdi: kullaniciAdi,
                online: false,
                profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi)
            });
            
            const arkadaslar = arkadasListeleri[kullaniciAdi] || [];
            arkadaslar.forEach(arkadas => {
                io.to(arkadas).emit('arkadas_durumu_degisti', {
                    kullaniciAdi: kullaniciAdi,
                    online: false,
                    profil: kullaniciProfilleri[kullaniciAdi] || varsayilanProfilOlustur(kullaniciAdi)
                });
            });
            
            console.log(`🔴 ${kullaniciAdi} bağlantıyı kesti`);
        }
    });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Discord Türk sunucusu ${PORT} portunda başlatıldı`);
});
