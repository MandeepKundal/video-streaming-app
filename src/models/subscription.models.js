import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // The person that will subscribe
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, // The channel that the subscriber is subscribing to
        ref: "User"
    }
},{ timeStamps: true });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);