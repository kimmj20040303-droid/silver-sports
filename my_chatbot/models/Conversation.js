const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    // We just need the ID, which Mongoose creates automatically
});

module.exports = mongoose.model('Conversation', conversationSchema);