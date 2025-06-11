# WhatsApp Bot V2 🤖

Bot WhatsApp pintar yang terintegrasi dengan AI (OpenAI GPT & Groq) dan sistem monitoring email otomatis.

## ✨ Fitur Utama

### 🤖 AI Chat Bot
- **Dual AI Support**: OpenAI GPT-3.5-turbo dan Groq AI
- **Smart Fallback**: Sistem fallback cerdas ketika API tidak tersedia
- **Conversation History**: Menyimpan riwayat percakapan per user
- **Bahasa Indonesia**: Respons natural dalam bahasa Indonesia

### 📧 Email Monitoring
- **Real-time Email Monitoring**: Monitor email Gmail secara real-time
- **Smart Filtering**: Filter email berdasarkan sender dan subject
- **Media Support**: Forward attachment (gambar, dokumen, audio, video)
- **Auto Forward**: Otomatis forward email ke WhatsApp

### 💬 WhatsApp Features
- **QR Code Login**: Login mudah dengan scan QR code
- **Command System**: Sistem command dengan prefix `!`
- **Media Support**: Kirim berbagai jenis media file
- **Auto Reconnect**: Reconnect otomatis jika koneksi terputus

## 🚀 Quick Start

### Prerequisites
- Node.js v16 atau lebih baru
- Gmail account dengan App Password
- OpenAI API Key (opsional)
- Groq API Key (opsional)

### Installation

1. **Clone repository**
```bash
git clone <repository-url>
cd WhatsappBotV2
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
```

Edit file `.env` dengan kredensial Anda:
```env
OPENAI_API_KEY=your-openai-api-key
GROQ_API_KEY=your-groq-api-key
GMAIL_EMAIL=your-gmail@gmail.com
GMAIL_PASSWORD=your-app-password
GMAIL_NUMBER=628xxxxxxxxx
```

4. **Jalankan bot**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

5. **Scan QR Code**
Scan QR code yang muncul di terminal dengan WhatsApp Anda.

## 📁 Struktur Project

```
WhatsappBotV2/
├── src/
│   ├── app.js                 # Main application
│   ├── config/
│   │   └── config.js          # Configuration file
│   └── services/
│       ├── openAIService.js   # OpenAI GPT service
│       ├── openAIService groq.js  # Groq AI service
│       └── emailService.js    # Email monitoring service
├── auth_info_baileys/         # WhatsApp auth data
├── temp/                      # Temporary files
├── .env                       # Environment variables
└── package.json
```

## 🎯 Commands

### WhatsApp Commands
- `!menu` - Tampilkan menu bot
- `!ping` - Test koneksi bot
- `clear history` - Hapus riwayat percakapan
- Chat bebas untuk bertanya ke AI

## ⚙️ Configuration

### Email Filtering
Edit [`src/services/emailService.js`](src/services/emailService.js) untuk mengatur filter email:

```javascript
const allowedSubjects = [
    'NOTIFICATION',
    'ALERT', 
    'URGENT',
    'SYSTEM'
];

const allowedSenders = [
    'deria3789@gmail.com'
];
```

### AI Configuration
- **OpenAI**: Menggunakan model `gpt-3.5-turbo`
- **Groq**: Fallback AI service
- **Smart Fallback**: Pattern matching untuk respons tanpa API

## 🔧 API Services

### OpenAI Integration
File: [`src/services/openAIService.js`](src/services/openAIService.js)
- Model: GPT-3.5-turbo
- Max tokens: 300
- Temperature: 0.7

### Groq AI Integration  
File: [`src/services/openAIService groq.js`](src/services/openAIService groq.js)
- Alternative AI service
- Same interface as OpenAI

### Email Service
File: [`src/services/emailService.js`](src/services/emailService.js)
- IMAP connection ke Gmail
- Real-time monitoring
- Attachment processing
- WhatsApp integration

## 📱 Supported Media Types

### Email Attachments
- **Images**: JPEG, PNG, GIF, WebP
- **Documents**: PDF, Word, Excel, PowerPoint
- **Audio**: MP3, WAV, OGG, AAC
- **Video**: MP4, AVI, MOV, WMV
- **Archives**: ZIP, RAR

### File Size Limits
- Maximum: 16MB per file
- WhatsApp limit: ~64MB (dibatasi untuk stabilitas)

## 🛠️ Development

### Development Mode
```bash
npm run dev
```
Menggunakan nodemon untuk auto-restart.

### Testing Email Connection
```bash
node src/services/emailService.js
```

## 🚨 Troubleshooting

### Common Issues

1. **QR Code tidak muncul**
   - Pastikan terminal mendukung QR code
   - Cek koneksi internet

2. **Email tidak termonitor**
   - Pastikan Gmail credentials benar
   - Enable "Less secure app access" atau gunakan App Password

3. **AI tidak merespon**
   - Cek API key OpenAI/Groq
   - Bot akan fallback ke smart responses

4. **WhatsApp terputus**
   - Bot akan auto-reconnect
   - Scan ulang QR code jika diperlukan

## 📄 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API Key | Optional |
| `GROQ_API_KEY` | Groq AI API Key | Optional |
| `GMAIL_EMAIL` | Gmail address | Required |
| `GMAIL_PASSWORD` | Gmail App Password | Required |
| `GMAIL_NUMBER` | WhatsApp target number | Required |

## 🔐 Security

- Jangan commit file `.env`
- Gunakan App Password untuk Gmail (bukan password utama)
- API keys disimpan di environment variables
- Auth data WhatsApp tersimpan lokal di [`auth_info_baileys/`](auth_info_baileys/)

## 📝 License

ISC License

## 👨‍💻 Author

Muhamad Dwi Putra Novriansyah
- Email: muhamaddwiputranovriansyah@gmail.com
- WhatsApp: +62 877-4820-2845

---

⭐ Jangan lupa star repository ini jika bermanfaat!