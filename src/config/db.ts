import mongoose from 'mongoose';
import { ENV } from './env';
import process from 'process';

const connectionString: string = ENV.MONGO_URI;

const connectDB = async () => {
    try {
        await mongoose.connect(connectionString);
    } catch (error) {
        process.exit(1);
    }
};

export default connectDB;
