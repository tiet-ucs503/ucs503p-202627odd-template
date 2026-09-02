const mongoose = require("mongoose");

const WorkerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    phone: {
        type: String
    },
    category: {
        type: String
    },
    experience: {
        type: Number
    },
    charges: {
        type: Number
    },
    location: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rating: {
        type: Number,
        default: 0
    },
    photo: {
        type: String
    },
    certifications: {
        type: [String]
    }
}, { timestamps: true });

module.exports = mongoose.model("Worker", WorkerSchema);

