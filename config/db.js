const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', false);
        const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/family-expense-tracker';
        const conn = await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log('MongoDB Connection Status:', mongoose.connection.readyState);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Set up error event listeners
        mongoose.connection.on('error', err => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            // Attempt to reconnect
            setTimeout(connectDB, 5000);
        });

    } catch (error) {
        console.error('MongoDB connection error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code
        });
        // Attempt to reconnect on initial connection failure
        setTimeout(connectDB, 5000);
    }
};

module.exports = connectDB; 