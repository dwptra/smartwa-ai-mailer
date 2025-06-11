const axios = require('axios');
require('dotenv').config();

// Store conversation history per user
const conversationHistory = new Map();

// Maksimal history per user
const MAX_HISTORY_LENGTH = 10;

function addToHistory(userId, role, message) {
    if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
    }
    
    const history = conversationHistory.get(userId);
    history.push({ role, content: message });
    
    // Keep only recent messages to avoid token limit
    if (history.length > MAX_HISTORY_LENGTH) {
        history.shift(); // Remove oldest message
    }
}

function getHistory(userId) {
    return conversationHistory.get(userId) || [];
}

function clearHistory(userId) {
    conversationHistory.delete(userId);
    console.log(`🗑️ Cleared chat history for user: ${userId}`);
}

async function generateResponse(message, userId = 'default') {
    try {
        if (!process.env.GROQ_API_KEY) {
            console.log('🔄 No Groq API key, using smart fallback...');
            return generateSmartFallback(message, userId);
        }

        console.log(`🤖 Generating response with Groq AI for user ${userId}:`, message);

        // Add user message to history
        addToHistory(userId, 'user', message);

        // Get conversation history
        const history = getHistory(userId);
        
        // Build messages array with system prompt + history
        const messages = [
            {
                role: 'system',
                content: 'Kamu adalah asisten AI WhatsApp yang ramah dan membantu. Jawab dalam bahasa Indonesia dengan natural dan singkat (maksimal 2-3 kalimat). Ingat percakapan sebelumnya untuk memberikan respons yang lebih personal.'
            },
            ...history // Include conversation history
        ];

        console.log(`📚 Using ${history.length} messages from history`);

        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama3-8b-8192',
                messages: messages,
                max_tokens: 200,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        const aiResponse = response.data.choices[0]?.message?.content || 'Maaf, tidak ada respons.';
        
        // Add AI response to history
        addToHistory(userId, 'assistant', aiResponse);
        
        console.log('✅ Groq AI response generated with history context');
        return aiResponse;

    } catch (error) {
        console.error('❌ Groq Error:', error.response?.data || error.message);
        console.log('🔄 Using smart fallback...');
        return generateSmartFallback(message, userId);
    }
}

function generateSmartFallback(message, userId) {
    const msg = message.toLowerCase();
    
    console.log(`🧠 Using smart fallback for user ${userId}:`, message);
    
    // Check for clear history command
    if (msg.includes('clear history') || msg.includes('hapus riwayat') || msg.includes('reset chat')) {
        clearHistory(userId);
        return 'Riwayat percakapan sudah dihapus. Mari mulai percakapan baru! 🔄✨';
    }
    
    // Get user's history for context
    const history = getHistory(userId);
    const hasHistory = history.length > 0;
    
    // Sophisticated pattern matching with history context
    if (msg.match(/\b(halo|hai|hello|hi|selamat)\b/)) {
        if (hasHistory) {
            const greetings = [
                'Halo lagi! Senang bertemu dengan Anda kembali. Ada yang bisa saya bantu? 😊',
                'Hai! Bagaimana kabar Anda hari ini? 🤗',
                'Hello! Saya ingat kita sudah pernah ngobrol. Ada yang ingin dibahas lagi? 🌟'
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        } else {
            const firstGreetings = [
                'Halo! Senang bertemu dengan Anda. Ada yang bisa saya bantu hari ini? 😊',
                'Hai! Saya siap membantu Anda. Bagaimana kabar Anda? 🤗',
                'Hello! Selamat datang! Ada yang ingin ditanyakan? 🌟'
            ];
            return firstGreetings[Math.floor(Math.random() * firstGreetings.length)];
        }
    }
    
    if (msg.includes('?') || msg.match(/\b(apa|bagaimana|kapan|dimana|siapa|kenapa|mengapa|berapa)\b/)) {
        const questionResponses = [
            'Pertanyaan yang menarik! Saya akan coba bantu jawab sebaik mungkin 🤔',
            'Hmm, biarkan saya pikirkan tentang itu. Bisa tolong jelaskan lebih detail? 💭',
            'Itu pertanyaan bagus! Saya siap membantu mencari jawabannya 📚'
        ];
        const response = questionResponses[Math.floor(Math.random() * questionResponses.length)];
        
        // Add to history for fallback too
        addToHistory(userId, 'user', message);
        addToHistory(userId, 'assistant', response);
        
        return response;
    }
    
    if (msg.match(/\b(terima kasih|thanks|makasih|thank you)\b/)) {
        const thankResponse = 'Sama-sama! Senang sekali bisa membantu Anda. Jangan ragu untuk bertanya lagi ya! 🙏✨';
        addToHistory(userId, 'user', message);
        addToHistory(userId, 'assistant', thankResponse);
        return thankResponse;
    }
    
    if (msg.match(/\b(bantuan|help|tolong|bantu)\b/)) {
        const helpResponse = 'Tentu saja! Saya di sini untuk membantu Anda. Silakan beritahu apa yang Anda butuhkan 💪';
        addToHistory(userId, 'user', message);
        addToHistory(userId, 'assistant', helpResponse);
        return helpResponse;
    }
    
    if (msg.match(/\b(siapa|who|kamu|anda)\b/)) {
        const aboutResponse = 'Saya adalah asisten AI WhatsApp yang siap membantu Anda 24/7! Saya bisa menjawab pertanyaan dan membantu dengan berbagai hal 🤖✨';
        addToHistory(userId, 'user', message);
        addToHistory(userId, 'assistant', aboutResponse);
        return aboutResponse;
    }
    
    // Default intelligent responses
    const smartResponses = [
        'Menarik! Terima kasih sudah berbagi dengan saya. Ada hal lain yang ingin dibahas? 🤔',
        'Saya mengerti maksud Anda. Apakah ada yang bisa saya bantu lebih lanjut? 💡',
        'Terima kasih atas pesannya! Saya senang bisa berkomunikasi dengan Anda 😊',
        'Pesan Anda sudah saya catat. Ada pertanyaan atau hal lain yang perlu dibahas? 📝'
    ];
    
    const response = smartResponses[Math.floor(Math.random() * smartResponses.length)];
    
    // Add to history
    addToHistory(userId, 'user', message);
    addToHistory(userId, 'assistant', response);
    
    return response;
}

// Export functions for external use
module.exports = { 
    generateResponse,
    clearHistory,
    getHistory,
    addToHistory
};