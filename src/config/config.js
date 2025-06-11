require('dotenv').config();

module.exports = {
    // evolutionApi: {
    //     baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:3000',
    //     apiKey: process.env.EVOLUTION_API_KEY || 'your-api-key'
    // },
    email: {
        user: process.env.GMAIL_EMAIL,
        password: process.env.GMAIL_PASSWORD,
        host: 'imap.gmail.com',
        port: 993
    },
    whatsapp: {
        targetNumber: process.env.GMAIL_NUMBER + '@s.whatsapp.net' // Replace with target number
    }
};