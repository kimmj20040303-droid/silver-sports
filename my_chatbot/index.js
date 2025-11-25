require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const path = require('path'); // 1. NEW: Import path module
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// Check if key is loaded
if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY is missing in .env file");
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

// 2. NEW: Tell the server to show the website files inside 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

// Route: Send a message
app.post('/message/:id', async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    try {
        let conversationId = id;

        if (id === 'new') {
            const newConversation = new Conversation();
            await newConversation.save();
            conversationId = newConversation._id;
        }

        const userMessage = new Message({
            conversationId: conversationId,
            role: 'user',
            content: message
        });
        await userMessage.save();

        const history = await Message.find({ conversationId: conversationId })
            .sort({ timestamp: 1 })
            .limit(10);

        const apiMessages = history.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: apiMessages,
        });

        const botResponse = completion.choices[0].message.content;

        const assistantMessage = new Message({
            conversationId: conversationId,
            role: 'assistant',
            content: botResponse
        });
        await assistantMessage.save();

        res.json({
            response: botResponse,
            conversationId: conversationId
        });

    } catch (error) {
        console.error("Error inside POST route:", error);
        res.status(500).send("Error processing request");
    }
});

// 3. NEW: Use the Port Render gives us, OR 3000 if on laptop
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});