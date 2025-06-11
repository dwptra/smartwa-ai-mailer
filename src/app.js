const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const config = require('./config/config.js');
const { generateResponse } = require('./services/openAIService.js');
const EmailMonitor = require('./services/emailService.js'); // Add this import at the top

// Function untuk memanggil Evolution API
async function callEvolutionApi(endpoint, data) {
    try {
        const response = await axios({
            method: 'post',
            url: `${config.evolutionApi.baseUrl}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${config.evolutionApi.apiKey}`,
                'Content-Type': 'application/json'
            },
            data
        });
        return response.data;
    } catch (error) {
        console.error('Evolution API Error:', error.response?.data || error.message);
        throw error;
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'debug' }), // Ubah level log ke debug
        printQRInTerminal: true,
        browser: ['WhatsApp Bot', 'Chrome', '1.0.0']
    });

    // Handle connection events
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log('Connection update:', update); // Tambah log
        
        if(qr) {
            // Tampilkan QR code di terminal
            qrcode.generate(qr, { small: true });
            console.log('Scan QR code di atas untuk login');
        }
        
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            console.log('Koneksi terputus karena ', lastDisconnect?.error?.message);
            
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('Terhubung ke WhatsApp');
            
            // Initialize email monitor
            const emailMonitor = new EmailMonitor(sock);
            emailMonitor.start();
            
            console.log('Email monitoring started');
        }
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    // Update message handler dengan Evolution API
    sock.ev.on('messages.upsert', async (m) => {
        try {
            if(m.type === 'notify') {
                for(const msg of m.messages) {
                    if(!msg.key.fromMe && msg.message) {
                        const sender = msg.key.remoteJid;
                        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
                        
                        console.log('------------------------');
                        console.log('New message detected!');
                        console.log(`From: ${sender}`);
                        console.log(`Message: ${messageText}`);
                        
                        try {
                            // Handle commands first
                            if(messageText.startsWith('!')) {
                                const command = messageText.slice(1).toLowerCase();
                                switch(command) {
                                    case 'menu':
                                        await sock.sendMessage(sender, { 
                                            text: '*MENU BOT*\n\n' +
                                                  '!menu - Tampilkan menu ini\n' +
                                                  '!ping - Test bot\n' +
                                                  'Kirim pesan apapun untuk bertanya ke AI'
                                        });
                                        break;
                                    case 'ping':
                                        await sock.sendMessage(sender, { text: 'Pong! 🏓' });
                                        break;
                                    default:
                                        await sock.sendMessage(sender, { 
                                            text: 'Command tidak dikenal. Ketik !menu untuk melihat menu.' 
                                        });
                                }
                            } else {
                                // Handle semua pesan non-command dengan GPT
                                console.log('Handling message with GPT:', messageText);
                                
                                await sock.sendPresenceUpdate('composing', sender);
                                
                                // Get response from ChatGPT
                                const gptResponse = await generateResponse(messageText, sender);
                                
                                console.log('GPT Response:', gptResponse);
                                
                                // Send the response
                                await sock.sendMessage(sender, { text: gptResponse });
                            }
                        } catch (error) {
                            console.error('Failed to process message:', error);
                            await sock.sendMessage(sender, { 
                                text: 'Maaf, terjadi kesalahan dalam memproses pesan Anda.' 
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in message handler:', error);
        }
    });

    // Tambahkan event listener untuk error
    sock.ev.on('error', err => {
        console.error('WebSocket Error:', err);
    });
}

// Jalankan koneksi
connectToWhatsApp().catch(err => console.log('Error:', err));