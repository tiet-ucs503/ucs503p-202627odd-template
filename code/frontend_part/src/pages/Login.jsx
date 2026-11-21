import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../api";

const Login = () => {
    const navigate = useNavigate();

    const [isSignUp, setIsSignUp] = useState(false);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            const data = isSignUp
                ? await registerUser(name, email, password)
                : await loginUser(email, password);

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            navigate("/");
        } catch (error) {
            console.error(
                isSignUp ? "Registration failed:" : "Login failed:",
                error
            );

            setError(
                error.response?.data?.message ||
                (isSignUp
                    ? "Unable to register. Please try again."
                    : "Unable to login. Please check your credentials.")
            );
        } finally {
            setLoading(false);
        }
    };

        return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7f8f4] px-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-sm border border-[#e3ebdf]">

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-[#24352b]">
                        Algo Recall
                    </h1>

                    <p className="mt-2 text-sm text-[#657568]">
                        Your personal DSA revision companion
                    </p>
                </div>

                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-semibold text-[#24352b]">
                        {isSignUp ? "Create Account" : "Welcome Back!"}
                    </h2>

                    <p className="mt-2 text-sm text-[#657568]">
                        {isSignUp
                            ? "Sign up to start your revision journey."
                            : "Sign in to continue your revision journey."}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-2xl bg-[#fbeceb] px-4 py-3 text-sm text-[#9b3b2f]">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {isSignUp && (
                        <div>
                            <label className="block mb-1 font-medium text-[#34483b]">
                                Name
                            </label>

                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full rounded-2xl border border-[#dce8d7] bg-[#fbfcf9] px-4 py-3 text-[#24352b] focus:outline-none focus:ring-2 focus:ring-[#aec5a7]"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block mb-1 font-medium text-[#34483b]">
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-2xl border border-[#dce8d7] bg-[#fbfcf9] px-4 py-3 text-[#24352b] focus:outline-none focus:ring-2 focus:ring-[#aec5a7]"
                            required
                        />
                    </div>

                    <div>
                        <label className="block mb-1 font-medium text-[#34483b]">
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full rounded-2xl border border-[#dce8d7] bg-[#fbfcf9] px-4 py-3 text-[#24352b] focus:outline-none focus:ring-2 focus:ring-[#aec5a7]"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-2xl bg-[#5f7f58] px-4 py-3 font-semibold text-white transition hover:bg-[#4d6a47] disabled:opacity-60"
                    >
                        {loading
                            ? (isSignUp ? "Creating Account..." : "Logging in...")
                            : (isSignUp ? "Sign Up" : "Log In")}
                    </button>

                </form>

                <div className="mt-6 text-center text-sm text-[#657568]">
                    {isSignUp
                        ? "Already have an account? "
                        : "Don't have an account? "}

                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError("");
                        }}
                        className="font-semibold text-[#4d6a47] hover:underline"
                    >
                        {isSignUp ? "Log In" : "Sign Up"}
                    </button>
                </div>

                <p className="mt-6 text-center text-xs text-[#9aa89b]">
                    Secure authentication for your DSA journey.
                </p>

            </div>
        </div>
    );
};

export default Login;