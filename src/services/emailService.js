const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const config = require('../config/config.js');
const fs = require('fs');
const path = require('path');

class EmailMonitor {
    constructor(whatsappClient) {
        this.imap = new Imap({
            user: config.email.user,
            password: config.email.password,
            host: config.email.host,
            port: config.email.port,
            tls: true,
            tlsOptions: { rejectUnauthorized: false }
        });

        this.whatsappClient = whatsappClient;
        this.targetWhatsappNumber = config.whatsapp.targetNumber;
        this.monitoringStartTime = null;
        
        // Folder untuk menyimpan attachment sementara
        this.tempAttachmentDir = path.join(__dirname, '../../temp/attachments');
        this.ensureTempDirectory();
    }

    // Pastikan folder temp ada
    ensureTempDirectory() {
        if (!fs.existsSync(this.tempAttachmentDir)) {
            fs.mkdirSync(this.tempAttachmentDir, { recursive: true });
            console.log('📁 Created temp attachment directory:', this.tempAttachmentDir);
        }
    }

    // Test connection method
    async testConnection() {
        return new Promise((resolve, reject) => {
            console.log('🔄 Testing email connection...');
            
            this.imap.once('ready', () => {
                console.log('✅ Successfully connected to email server!');
                
                this.imap.openBox('INBOX', false, (err, box) => {
                    if (err) {
                        console.error('❌ Error opening inbox:', err);
                        this.imap.end();
                        reject(err);
                        return;
                    }
                    
                    console.log('✅ Successfully opened inbox');
                    console.log(`📫 Total emails: ${box.messages.total}`);
                    console.log(`📬 New emails: ${box.messages.new}`);
                    
                    // Get latest 3 emails
                    if (box.messages.total > 0) {
                        const startSeq = Math.max(1, box.messages.total - 2);
                        const fetch = this.imap.seq.fetch(`${startSeq}:${box.messages.total}`, {
                            bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
                            struct: true
                        });

                        let emailCount = 0;
                        fetch.on('message', (msg, seqno) => {
                            msg.on('body', (stream) => {
                                let buffer = '';
                                stream.on('data', (chunk) => {
                                    buffer += chunk.toString('utf8');
                                });
                                stream.once('end', () => {
                                    emailCount++;
                                    console.log(`📧 Email #${seqno}:`);
                                    console.log(buffer);
                                    console.log('-------------------');
                                });
                            });
                        });

                        fetch.once('end', () => {
                            console.log(`✨ Connection test completed - Found ${emailCount} recent emails`);
                            this.imap.end();
                            resolve(true);
                        });
                    } else {
                        console.log('📭 No emails found in inbox');
                        this.imap.end();
                        resolve(true);
                    }
                });
            });

            this.imap.once('error', (err) => {
                console.error('❌ Connection error:', err);
                reject(err);
            });

            this.imap.connect();
        });
    }

    start() {
        console.log('🚀 Starting email monitor...');
        this.monitoringStartTime = new Date(); // Set waktu start monitoring
        console.log('⏰ Monitoring started at:', this.monitoringStartTime.toLocaleString());
        
        this.imap.connect();

        this.imap.once('ready', () => {
            console.log('✅ Email monitor connected successfully');
            this.watchInbox();
        });

        this.imap.once('error', (err) => {
            console.error('❌ IMAP connection error:', err);
        });
    }

    watchInbox() {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) throw err;

            console.log('👁️ Watching inbox for new emails...');

            // Listen for new emails
            this.imap.on('mail', () => {
                console.log('📬 New email detected!');
                this.processNewEmails();
            });
        });
    }

    async processNewEmails() {
        try {
            // Search untuk email yang masuk setelah monitoring dimulai
            const searchCriteria = [
                'UNSEEN', // Email belum dibaca
                ['SINCE', this.monitoringStartTime] // Email yang masuk setelah monitoring dimulai
            ];

            this.imap.search(searchCriteria, (err, results) => {
                if (err) {
                    console.error('❌ Error searching for new emails:', err);
                    return;
                }
                
                if (!results || results.length === 0) {
                    console.log('📭 No new emails found since monitoring started');
                    return;
                }

                console.log(`📬 Found ${results.length} new email(s) since monitoring started`);

                // Fetch email dengan struktur lengkap untuk attachment
                const fetch = this.imap.fetch(results, {
                    bodies: '',
                    struct: true, // Penting untuk mendapatkan struktur attachment
                    markSeen: true // Tandai sebagai sudah dibaca setelah diproses
                });

                fetch.on('message', (msg) => {
                    msg.on('body', (stream) => {
                        simpleParser(stream, async (err, parsed) => {
                            if (err) {
                                console.error('❌ Error parsing email:', err);
                                return;
                            }

                            // Double check: pastikan email masuk setelah monitoring dimulai
                            if (parsed.date < this.monitoringStartTime) {
                                console.log('⏭️ Email is older than monitoring start time, skipping...');
                                return;
                            }

                            console.log('📧 Processing new email from:', parsed.from.text);
                            console.log('📧 Subject:', parsed.subject);
                            console.log('📧 Date:', parsed.date);

                            // Check attachments
                            if (parsed.attachments && parsed.attachments.length > 0) {
                                console.log(`📎 Found ${parsed.attachments.length} attachment(s)`);
                            }

                            // Check if email matches required format
                            if (this.isValidEmailFormat(parsed)) {
                                console.log('✅ Email matches format, forwarding to WhatsApp...');
                                await this.forwardEmailToWhatsapp(parsed);
                            } else {
                                console.log('⏭️ Email does not match format, skipping...');
                            }
                        });
                    });
                });

                fetch.once('error', (err) => {
                    console.error('❌ Error fetching emails:', err);
                });

                fetch.once('end', () => {
                    console.log('✅ Finished processing new emails');
                });
            });
        } catch (error) {
            console.error('❌ Error in processNewEmails:', error);
        }
    }

    // Method baru untuk handle forward email dengan attachment
    async forwardEmailToWhatsapp(parsedEmail) {
        try {
            // Kirim pesan teks terlebih dahulu
            const textMessage = this.formatEmailForWhatsapp(parsedEmail);
            await this.sendToWhatsapp(textMessage);

            // Proses dan kirim attachment jika ada
            if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
                console.log(`📎 Processing ${parsedEmail.attachments.length} attachment(s)...`);
                
                for (const attachment of parsedEmail.attachments) {
                    await this.processAndSendAttachment(attachment);
                }
            }

        } catch (error) {
            console.error('❌ Error forwarding email to WhatsApp:', error);
        }
    }

    // Method untuk memproses dan mengirim attachment
    async processAndSendAttachment(attachment) {
        try {
            // Validasi ukuran file (WhatsApp limit ~64MB, tapi kita batasi 16MB untuk aman)
            const maxSizeInMB = 16;
            const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
            
            if (attachment.size > maxSizeInBytes) {
                console.log(`⚠️ Attachment "${attachment.filename}" terlalu besar (${(attachment.size / 1024 / 1024).toFixed(2)}MB), melewati...`);
                await this.sendToWhatsapp(`⚠️ File "${attachment.filename}" terlalu besar untuk dikirim (${(attachment.size / 1024 / 1024).toFixed(2)}MB > ${maxSizeInMB}MB)`);
                return;
            }

            // Validasi tipe file yang didukung WhatsApp
            const supportedTypes = [
                // Gambar
                'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
                // Dokumen
                'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/plain', 'text/csv',
                // Audio
                'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
                // Video
                'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
                // Archive
                'application/zip', 'application/x-rar-compressed'
            ];

            if (!supportedTypes.includes(attachment.contentType)) {
                console.log(`⚠️ Tipe file "${attachment.contentType}" tidak didukung WhatsApp, melewati...`);
                await this.sendToWhatsapp(`⚠️ File "${attachment.filename}" memiliki tipe yang tidak didukung (${attachment.contentType})`);
                return;
            }

            // Simpan attachment ke file sementara
            const tempFilePath = path.join(this.tempAttachmentDir, `${Date.now()}_${attachment.filename}`);
            fs.writeFileSync(tempFilePath, attachment.content);

            console.log(`💾 Saved attachment: ${tempFilePath}`);
            console.log(`📄 File info: ${attachment.filename} (${(attachment.size / 1024).toFixed(2)}KB, ${attachment.contentType})`);

            // Siapkan media message untuk WhatsApp
            const mediaMessage = await this.prepareMediaMessage(tempFilePath, attachment);

            // Kirim ke WhatsApp
            await this.sendMediaToWhatsapp(mediaMessage, attachment.filename);

            // Hapus file sementara setelah dikirim
            setTimeout(() => {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log(`🗑️ Deleted temp file: ${tempFilePath}`);
                }
            }, 5000); // Hapus setelah 5 detik

        } catch (error) {
            console.error('❌ Error processing attachment:', error);
            await this.sendToWhatsapp(`❌ Gagal memproses file "${attachment.filename}": ${error.message}`);
        }
    }

    // Method untuk menyiapkan media message berdasarkan tipe file
    async prepareMediaMessage(filePath, attachment) {
        const contentType = attachment.contentType.toLowerCase();
        
        if (contentType.startsWith('image/')) {
            return {
                image: { url: filePath },
                caption: `📸 ${attachment.filename}\n${(attachment.size / 1024).toFixed(2)}KB`
            };
        } else if (contentType.startsWith('video/')) {
            return {
                video: { url: filePath },
                caption: `🎥 ${attachment.filename}\n${(attachment.size / 1024).toFixed(2)}KB`
            };
        } else if (contentType.startsWith('audio/')) {
            return {
                audio: { url: filePath },
                mimetype: attachment.contentType
            };
        } else {
            // Untuk dokumen dan file lainnya
            return {
                document: { url: filePath },
                mimetype: attachment.contentType,
                fileName: attachment.filename,
                caption: `📄 ${attachment.filename}\n${(attachment.size / 1024).toFixed(2)}KB`
            };
        }
    }

    // Method untuk mengirim media ke WhatsApp
    async sendMediaToWhatsapp(mediaMessage, filename) {
        try {
            console.log(`📱 Sending ${filename} to WhatsApp...`);
            await this.whatsappClient.sendMessage(this.targetWhatsappNumber, mediaMessage);
            console.log(`✅ ${filename} sent to WhatsApp successfully`);
        } catch (error) {
            console.error(`❌ Error sending ${filename} to WhatsApp:`, error);
            throw error;
        }
    }

    // Update format pesan untuk menyertakan info attachment
    formatEmailForWhatsapp(parsedEmail) {
        let message = `*📧 New Email Notification*\n\n` +
                     `*From:* ${parsedEmail.from.text}\n` +
                     `*Subject:* ${parsedEmail.subject}\n` +
                     `*Date:* ${parsedEmail.date}\n`;

        // Tambahkan info attachment jika ada
        if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
            message += `*Attachments:* ${parsedEmail.attachments.length} file(s)\n`;
            parsedEmail.attachments.forEach((att, index) => {
                message += `   ${index + 1}. ${att.filename} (${(att.size / 1024).toFixed(2)}KB)\n`;
            });
        }

        message += `-------------------\n` +
                  `${parsedEmail.text ? parsedEmail.text.substring(0, 500) : 'No text content'}...`;

        return message;
    }

    isValidEmailFormat(parsedEmail) {
        // Konfigurasi filter - bisa ditambah manual nantinya
        const allowedSubjects = [
            'NOTIFICATION',
            'ALERT', 
            'URGENT',
            'SYSTEM',
            'BACKUP',
            'ERROR',
            'WARNING'
        ];
        
        const allowedSenders = [
            'deria3789@gmail.com'
        ];

        const subject = parsedEmail.subject.toUpperCase(); // Convert ke uppercase untuk matching
        const fromEmail = parsedEmail.from.text.toLowerCase();
        
        // Check if subject contains any of the allowed keywords
        const subjectMatch = allowedSubjects.some(keyword => 
            subject.includes(keyword)
        );
        
        // Check if sender is from allowed email
        const senderMatch = allowedSenders.some(email => 
            fromEmail.includes(email.toLowerCase())
        );

        // Email harus dari sender yang diizinkan DAN memiliki subject yang valid
        const isValid = senderMatch && subjectMatch;

        console.log('🔍 Email validation check:');
        console.log(`   Subject: "${parsedEmail.subject}"`);
        console.log(`   From: "${parsedEmail.from.text}"`);
        console.log(`   Subject match: ${subjectMatch} (keywords: ${allowedSubjects.join(', ')})`);
        console.log(`   Sender match: ${senderMatch} (allowed: ${allowedSenders.join(', ')})`);
        console.log(`   Final result: ${isValid}`);

        return isValid;
    }

    async sendToWhatsapp(message) {
        try {
            console.log('📱 Sending to WhatsApp:', this.targetWhatsappNumber);
            await this.whatsappClient.sendMessage(this.targetWhatsappNumber, { 
                text: message 
            });
            console.log('✅ Message sent to WhatsApp successfully');
        } catch (error) {
            console.error('❌ Error sending to WhatsApp:', error);
        }
    }
}

// Test function - hanya jalan jika file ini dijalankan langsung
if (require.main === module) {
    console.log('🧪 Running email connection test...');
    const emailMonitor = new EmailMonitor(null); // null karena tidak butuh WhatsApp client untuk test
    emailMonitor.testConnection()
        .then(() => {
            console.log('🎉 Test completed successfully!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('💥 Test failed:', err);
            process.exit(1);
        });
}

module.exports = EmailMonitor;