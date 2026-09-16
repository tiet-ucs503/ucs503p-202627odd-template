const express = require("express");

const router = express.Router();

module.exports = (supabase) => {

    // Send OTP to student's college email
    router.post("/send-otp", async (req, res) => {

        try {
            const { email } = req.body;

            // Check if email was provided
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: "Email is required."
                });
            }

            // Only allow college email addresses
            if (!email.toLowerCase().endsWith("@thapar.edu")) {
                return res.status(400).json({
                    success: false,
                    message: "Please use your college email address."
                });
            }

            // Send OTP
            const { error } = await supabase.auth.signInWithOtp({
                email: email.toLowerCase()
            });

            if (error) {
                return res.status(500).json({
                    success: false,
                    message: error.message
                });
            }

            res.json({
                success: true,
                message: "OTP sent to your college email."
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });


    // Verify OTP
    router.post("/verify-otp", async (req, res) => {

        try {
            const { email, token } = req.body;

            if (!email || !token) {
                return res.status(400).json({
                    success: false,
                    message: "Email and OTP are required."
                });
            }

            const { data, error } = await supabase.auth.verifyOtp({
                email: email.toLowerCase(),
                token: token,
                type: "email"
            });

            if (error) {
                return res.status(401).json({
                    success: false,
                    message: error.message
                });
            }

            res.json({
                success: true,
                message: "Login successful!",
                session: data.session,
                user: data.user
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });


    return router;
};