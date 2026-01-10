const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// JWT Gizli Anahtar
const JWT_GIZLI_ANAHTAR = process.env.JWT_GIZLI_ANAHTAR || 'discord_turk_gizli_anahtar_2024_test';

// Basit veri saklama
const kullanicilar = {};
const arkadasListeleri = {};
const mesajlar = {};

app.use(express.json());
app.use(express.static(__dirname));

// API Rotaları
app.post('/kayit', async (req, res) => {
    try {
        const { kullaniciAdi, sifre } = req.body;
        
        if (!kullaniciAdi || !sifre) {
            return res.status(400).json({ hata: 'Kullanıcı adı ve şifre gereklidir' });
        }
        
        if (kullanicilar[kullaniciAdi]) {
            return res.status(400).json({ hata: 'Bu kullanıcı adı zaten kullanılıyor' });
        }
        
        const sifrelenmisSifre = await bcrypt.hash(sifre, 10);
        kullanicilar[kullaniciAdi] = { 
            kullaniciAdi, 
            sifre: sifrelenmisSifre,
            kayitTarihi: new Date().toISOString()
        };
        
        arkadasListeleri[kullaniciAdi] = [];
        mesajlar[kullaniciAdi] = [];
        
        console.log(`Yeni kayıt: ${kullaniciAdi}`);
        res.json({ mesaj: 'Kayıt başarılı! Giriş yapabilirsiniz.' });
    } catch (error) {
        console.error('Kayıt hatası:', error);
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

app.post('/giris', async (req, res) => {
    try {
        const { kullaniciAdi, sifre } = req.body;
        
        if (!kullaniciAdi || !sifre) {
            return res.status(400).json({ hata: 'Kullanıcı adı ve şifre gereklidir' });
        }
        
        const kullanici = kullanicilar[kullaniciAdi];
        
        if (!kullanici) {
            return res.status(401).json({ hata: 'Kullanıcı adı veya şifre hatalı' });
        }
        
        const sifreDogruMu = await bcrypt.compare(sifre, kullanici.sifre);
        
        if (!sifreDogruMu) {
            return res.status(401).json({ hata: 'Kullanıcı adı veya şifre hatalı' });
        }
        
        // JWT Token oluştur
        const token = jwt.sign(
            { 
                kullaniciAdi: kullanici.kullaniciAdi,
                tarih: new Date().toISOString()
            }, 
            JWT_GIZLI_ANAHTAR,
            { expiresIn: '7d' }
        );
        
        res.json({ 
            token: token,
            kullaniciAdi: kullanici.kullaniciAdi 
        });
    } catch (error) {
        console.error('Giriş hatası:', error);
        res.status(500).json({ hata: 'Sunucu hatası' });
    }
});

// Kullanıcı doğrulama middleware
const kullaniciDogrula = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
        return decoded;
    } catch (error) {
        return null;
    }
};

// Socket.IO Gerçek Zamanlı İletişim
io.on('connection', (socket) => {
    console.log('Yeni bağlantı:', socket.id);
    
    // Kullanıcı kimlik doğrulama
    socket.on('kimlik_dogrulama', (token) => {
        try {
            const decoded = jwt.verify(token, JWT_GIZLI_ANAHTAR);
            socket.kullaniciAdi = decoded.kullaniciAdi;
            socket.join(decoded.kullaniciAdi);
            
            console.log(`${decoded.kullaniciAdi} kimliği doğrulandı`);
            socket.emit('kimlik_dogrulandi', { 
                basarili: true, 
                kullaniciAdi: decoded.kullaniciAdi 
            });
        } catch (error) {
            console.log('Geçersiz token:', error.message);
            socket.emit('kimlik_dogrulandi', { 
                basarili: false, 
                hata: 'Geçersiz token. Lütfen tekrar giriş yapın.' 
            });
            socket.disconnect();
        }
    });
    
    // Arkadaş ekleme
    socket.on('arkadas_ekle', (arkadasKullaniciAdi) => {
        if (!socket.kullaniciAdi) {
            socket.emit('hata', 'Önce giriş yapmalısınız');
            return;
        }
        
        if (arkadasKullaniciAdi === socket.kullaniciAdi) {
            socket.emit('hata', 'Kendinizi arkadaş olarak ekleyemezsiniz');
            return;
        }
        
        if (kullanicilar[arkadasKullaniciAdi]) {
            if (!arkadasListeleri[socket.kullaniciAdi]) {
                arkadasListeleri[socket.kullaniciAdi] = [];
            }
            
            if (!arkadasListeleri[socket.kullaniciAdi].includes(arkadasKullaniciAdi)) {
                arkadasListeleri[socket.kullaniciAdi].push(arkadasKullaniciAdi);
                socket.emit('arkadas_eklendi', arkadasKullaniciAdi);
                
                // Arkadaşa bildirim gönder
                io.to(arkadasKullaniciAdi).emit('yeni_arkadas_istegi', {
                    kimden: socket.kullaniciAdi,
                    tarih: new Date().toLocaleString('tr-TR')
                });
                
                console.log(`${socket.kullaniciAdi}, ${arkadasKullaniciAdi} arkadaş ekledi`);
            } else {
                socket.emit('hata', 'Bu kullanıcı zaten arkadaşınız');
            }
        } else {
            socket.emit('hata', 'Kullanıcı bulunamadı');
        }
    });
    
    // Özel mesaj gönderme
    socket.on('ozel_mesaj', ({ kime, mesaj }) => {
        if (!socket.kullaniciAdi) {
            socket.emit('hata', 'Önce giriş yapmalısınız');
            return;
        }
        
        if (!mesaj || mesaj.trim() === '') {
            socket.emit('hata', 'Mesaj boş olamaz');
            return;
        }
        
        const mesajObjesi = {
            kimden: socket.kullaniciAdi,
            kime,
            mesaj: mesaj.trim(),
            tarih: new Date().toISOString(),
            okundu: false
        };
        
        // Mesajları sakla
        if (!mesajlar[kime]) mesajlar[kime] = [];
        if (!mesajlar[socket.kullaniciAdi]) mesajlar[socket.kullaniciAdi] = [];
        
        mesajlar[kime].push(mesajObjesi);
        mesajlar[socket.kullaniciAdi].push(mesajObjesi);
        
        // Alıcıya gönder (eğer çevrimiçiyse)
        io.to(kime).emit('ozel_mesaj', mesajObjesi);
        
        // Gönderene de gönder
        socket.emit('ozel_mesaj', mesajObjesi);
        
        console.log(`Mesaj: ${socket.kullaniciAdi} -> ${kime}: ${mesaj.substring(0, 30)}...`);
    });
    
    // Arkadaş listesini getir
    socket.on('arkadaslari_getir', () => {
        if (socket.kullaniciAdi) {
            const arkadaslar = arkadasListeleri[socket.kullaniciAdi] || [];
            socket.emit('arkadas_listesi', arkadaslar);
        }
    });
    
    // Mesaj geçmişini getir
    socket.on('mesaj_gecmisi_getir', (arkadasKullaniciAdi) => {
        if (socket.kullaniciAdi) {
            const tumMesajlar = mesajlar[socket.kullaniciAdi] || [];
            const filtrelenmis = tumMesajlar.filter(
                msg => (msg.kimden === arkadasKullaniciAdi && msg.kime === socket.kullaniciAdi) ||
                       (msg.kimden === socket.kullaniciAdi && msg.kime === arkadasKullaniciAdi)
            ).sort((a, b) => new Date(a.tarih) - new Date(b.tarih));
            
            socket.emit('mesaj_gecmisi', filtrelenmis);
        }
    });
    
    // Çevrimiçi durumu
    socket.on('disconnect', () => {
        if (socket.kullaniciAdi) {
            console.log(`${socket.kullaniciAdi} bağlantıyı kesti`);
        }
    });
    
    // Hata yakalama
    socket.on('error', (error) => {
        console.error('Socket hatası:', error);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor`);
    console.log(`JWT Anahtar: ${JWT_GIZLI_ANAHTAR.substring(0, 10)}...`);
});