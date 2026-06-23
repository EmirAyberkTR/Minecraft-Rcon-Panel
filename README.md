# MC Panel 🎮🖥️

Minecraft sunucunuzu izlemek ve yönetmek için **Electron** ve **Vanilla JS/CSS** ile geliştirilmiş, modern ve hafif bir masaüstü uygulaması. Bu panel, Debian sunucunuzda çalışan özel bir **Python (Flask/psutil) Sistem Agent'ı** ve **RCON** protokolünü birleştirerek canlı donanım metrikleri, oyuncu yönetimi ve anlık log takibi sunar.

---

## 🚀 Öne Çıkan Özellikler

- **📊 Canlı Dashboard:** CPU kullanımı, RAM tüketimi, TPS (Ticks Per Second), MSPT (Milliseconds Per Tick), Disk alanı ve aktif oyuncu slotlarını anlık olarak izleyin.
- **📜 Canlı Konsol Akışı:** Klasik RCON komut yanıtlarının ötesinde, Python Agent sayesinde sunucudaki `latest.log` dosyasını anlık olarak panele akıtır. Oyuncu chat'lerini, giriş-çıkış loglarını ve sunucu hatalarını sıfır gecikmeyle takip edin.
- **👥 Oyuncu Yönetimi:** Çevrimiçi oyuncuları listeyin, ping sürelerini (ms) ve bulundukları dünyaları görün. `Işınlan (TP) [Henüz düzgün çalışmıyor]`, `Mesaj Gönder [Henüz düzgün çalışmıyor]`, `Kick` veya `Ban` gibi işlemleri arayüzden tek tıkla uygulayın.
- **👑 OP (Operatör) Yönetimi:** Sunucudaki operatör listesini `ops.json` üzerinden dinamik olarak çekin, tek tıkla yetki verin veya alın.
- **🔌 Plugin Denetleyicisi:** Yüklü olan tüm pluginleri listeyin; tam versiyonlarını, yazarlarını, açıklamalarını ve aktiflik durumlarını (aktif/devre dışı) görün.
- **🎨 Modern Arayüz:** Çerçevesiz (frameless) pencere tasarımı, koyu tema renk paleti ve akıcı geçişler.
<img width="1211" height="643" alt="image" src="https://github.com/user-attachments/assets/33dde83a-d11a-4020-ae13-c5b68621eede" />
<img width="1210" height="641" alt="image" src="https://github.com/user-attachments/assets/57a84058-250f-4832-9810-785b56d50f40" />
---

## 🛠️ Sistem Mimarisi

Proje bağımsız çalışan iki ana parçadan oluşur:
1. **Masaüstü İstemcisi (Electron Uygulaması):** Bilgisayarınızda yerel olarak çalışır, RCON (port `25575`) ve Agent'ın HTTP endpoint'leri üzerinden sunucuyla haberleşir.
2. **Sistem Agent'ı (Python Scripti):** **Debian/Linux** sunucunuzda arka planda sessizce çalışır, donanım istatistiklerini toplar ve yerel dosyaları okur.

---

## 📦 Kurulum ve Çalıştırma

### 1. Sunucu Tarafı Kurulumu (Debian)

`agent.py` dosyasını sunucunuza yükleyin ve gerekli bağımlılıkları kurun:

```bash
# Bağımlılıkları kurun
pip3 install flask psutil --break-system-packages

# Agent'ı arka planda başlatın
nohup python3 agent.py &

💡 agent.py içindeki MC_SERVER_DIR değişkenine Minecraft sunucunuzun doğru klasör yolunu yazdığınızdan emin olun.

2. İstemci Kurulumu ve Derleme (Yerel Bilgisayar)

Masaüstü panelini çalıştırmak veya çalıştırılabilir (.exe) hale getirmek için terminalde sırayla şu komutları kullanın:
Bash

# Bağımlılıkları yükleyin
npm install

# Geliştirici modunda çalıştırın
npm start

# Taşınabilir (Portable) tek bir .exe dosyası üretin
npm run build:portable

# Kurulum sihirbazlı standart bir setup dosyası üretin
npm run build

⚙️ Yapılandırma (package.json)

Uygulama, electron-builder kullanılarak otomatik derleme süreçleri için önceden yapılandırılmıştır. Derleme çıktısı doğrudan dist/ klasörüne aktarılır.
JSON

"version": "1.1.0",
"build": {
  "appId": "com.mcpanel.app",
  "productName": "MC Panel",
  "win": {
    "icon": "assets/icon.ico",
    "target": ["nsis", "portable"]
  }
}

🧰 Teknoloji Yığını

    Frontend: HTML5, CSS3 (Custom Variables, Grid, Flexbox), Vanilla JavaScript

    Backend/Masaüstü: Node.js, Electron Framework, rcon-client

    Sunucu İzleme: Python 3, Flask, psutil

    Derleyici: electron-builder

📝 Lisans

MIT Lisansı ile dağıtılmaktadır. Kendi sanal sunucu ağlarınız için dilediğiniz gibi değiştirebilir ve uyarlayabilirsiniz!
