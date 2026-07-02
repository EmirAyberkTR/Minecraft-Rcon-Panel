# MC Panel

Bu panel Minecraft sunucunuzu takip etmek ve yönetmek için ai ile geliştirilmiş bir uygulamadır. Electron tabanlı istemci ile Python üzerinde çalışan bir agent ile birlikte çalışır. Sistem, RCON ve yerel HTTP endpoint’leri üzerinden sunucu ile iletişim kurar.

---

## Öne Çıkan Özellikler

- Sunucu metriklerinin canlı takibi (CPU, RAM, disk kullanımı)
- Minecraft performans verileri (TPS, MSPT)
- Oyuncu listesi ve temel yönetim işlemleri (kick, ban, mesaj gönderme, teleport)
- OP kullanıcı yönetimi
- Plugin listeleme ve durum bilgisi
- Sunucu loglarının anlık görüntülenmesi
- RCON üzerinden komut çalıştırma
<img width="1270" height="809" alt="image" src="https://github.com/user-attachments/assets/33a0407d-206f-4565-8ce0-3374190a44d9" />
<img width="1276" height="820" alt="image" src="https://github.com/user-attachments/assets/e7b44400-31cd-4587-a1cc-c70f627bb710" />

## Sistem Mimarisi

**1. Electron İstemcisi**

Kullanıcının masaüstünde çalışan ana uygulamadır. Arayüzü sağlar ve sunucu ile iletişim kurar.

**2. Python Agent**

Sunucu tarafında çalışan hafif bir servisdir.

Sistem kaynaklarını izler (psutil)
Minecraft sunucu klasöründen veri okur
Flask API üzerinden istemciye veri sağlar

RCON (varsayılan port: 25575)
HTTP API (Flask agent)

## Kurulum ve Çalıştırma

**Agent'ı Windows'da çalıştırmak için:**

---

Python 3.10 veya üzeri kurulu olmalıdır

https://www.python.org/downloads/

Kurulum sırasında “Add Python to PATH” seçeneğini tikleyin.

CMD'den agent.py dosyasının bulunduğu klasöre gidin:
```bash
cd proje-klasoru
```

Gerekli Paketleri Yüklemek İçin:
```bash
pip install flask psutil
```

Çalıştırmak için:
```bash
python agent.py
```
Varsayılan port:

7842

!!GÜVENLİĞİNİZ İÇİN BU PORTU İNTERNETE AÇMAYIN!!

---

**Agent’ı Linux'da çalıştırmak için:**

Gereksinimleri kurun:
```bash
pip3 install flask psutil --break-system-packages
```
Arka planda çalıştırın
```bash
nohup python3 agent.py &

# agent.py içindeki MC_SERVER_DIR değişkeni doğru Minecraft sunucu dizinine ayarlamanız gerekiyor.
```
**nohup yerine systemctl servisi olarak kullanmak isterseniz eğer:**

Servis dosyasını oluşturmak için, ismi istediğiniz gibi ayarlayabilirsiniz.
```bash
sudo nano /etc/systemd/system/mc-panel-agent.service
```
Servis dosyasını düzenliyoruz. ExecStart kısmındaki 2. dosya yolu örnekteki gibi agent.py dosyanızın yolu olması gerek yoksa çalışmaz!
```ini
[Unit]
Description=MC Panel Minecraft Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /home/kullaniciadi/mc-sunucusu/agent.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
Servisi başlatmak için:
```bash
sudo systemctl daemon-reload
sudo systemctl enable mc-panel-agent
sudo systemctl start mc-panel-agent
```
Servisin durumuna bakmak için (Servisi başlattıktan sonra kesin kontrol edin)
```bash
sudo systemctl status mc-panel-agent
```
---

**İstemci (Electron)**
```bash
npm install
npm start
```
**Releases'dan indirirseniz bunu yapmanıza gerek yok bu kısım ve devamındaki yer sizin build etmeniz için.**

**Derleme**
```bash
npm run build:portable
npm run build
```

**Yapılandırma**

electron-builder kullanılarak build süreci yönetilir.
```json
{
  "version": "1.1.0",
  "build": {
    "appId": "com.mcpanel.app",
    "productName": "MC Panel",
    "win": {
      "icon": "assets/icon.ico",
      "target": ["nsis", "portable"]
    }
  }
}
```

**Teknolojiler**
- Electron
- Node.js
- Vanilla JavaScript / HTML / CSS
- Python 3
- Flask
- psutil
- electron-builder

**Lisans**

MIT
