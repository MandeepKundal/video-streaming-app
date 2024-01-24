import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const dbUrl = process.env.MONGODB_URI;

const connectDb = async () => {
    try {
        const connectionResponse = await mongoose.connect(`${dbUrl}/${DB_NAME}`);
        console.log("MongoDB connected!");
        console.log(`DB Host: ${connectionResponse.connection.host}`);
    } catch (error) {
        console.log("Error while connecting to mongodb:", error);
        process.exit(1);
    }
}

export default connectDb;