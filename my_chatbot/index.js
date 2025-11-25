require('dotenv').config(); // MUST BE LINE 1
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// check if key is loaded
if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY is missing in .env file");
    process.exit(1);
}

// Setup OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

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

        // 1. Create a new conversation if ID is 'new'
        if (id === 'new') {
            const newConversation = new Conversation();
            await newConversation.save();
            conversationId = newConversation._id;
        }

        // 2. Save the User's message
        const userMessage = new Message({
            conversationId: conversationId,
            role: 'user',
            content: message
        });
        await userMessage.save();

        // 3. Fetch recent chat history
        const history = await Message.find({ conversationId: conversationId })
            .sort({ timestamp: 1 })
            .limit(10);

        // 4. Format messages for OpenAI
        const apiMessages = history.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // 5. Send to OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: apiMessages,
        });

        const botResponse = completion.choices[0].message.content;

        // 6. Save Assistant's response
        const assistantMessage = new Message({
            conversationId: conversationId,
            role: 'assistant',
            content: botResponse
        });
        await assistantMessage.save();

        // 7. Send back
        res.json({
            response: botResponse,
            conversationId: conversationId
        });

    } catch (error) {
        console.error("Error inside POST route:", error);
        res.status(500).send("Error processing request");
    }
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});