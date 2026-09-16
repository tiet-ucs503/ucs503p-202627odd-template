require("dotenv").config();

const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = 5000;

app.use(express.json());

// Connect to Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes(supabase));

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "Digital Hostel Laundry Management System API is running!"
    });
});

// Test Supabase connection
app.get("/api/test-db", async (req, res) => {
    const { data, error } = await supabase
        .from("hostels")
        .select("*");

    if (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }

    res.json({
        success: true,
        message: "Supabase connection successful!",
        data: data
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});