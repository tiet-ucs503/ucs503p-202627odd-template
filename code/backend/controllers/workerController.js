const Worker = require("../models/Worker");
const User = require("../models/User");

const registerWorkerProfile = async (req, res) => {
    try {
        const { phone, category, experience, charges, location } = req.body;

        const existingProfile = await Worker.findOne({ userId: req.user._id });
        if (existingProfile) {
            return res.status(400).json({ message: "Worker profile already exists" });
        }

        const workerProfile = await Worker.create({
            userId: req.user._id,
            phone,
            category,
            experience,
            charges,
            location,
            status: "pending"
        });

        res.status(201).json(workerProfile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getWorkerById = async (req, res) => {
    try {
        const worker = await Worker.findById(req.params.id).populate('userId', 'name email');
        
        if (!worker) {
            return res.status(404).json({ message: "Worker not found" });
        }

        if (worker.status !== 'approved') {
            worker.phone = undefined;
        }

        res.json(worker);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { registerWorkerProfile, getWorkerById };

