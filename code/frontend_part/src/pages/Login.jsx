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
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-800">
                        Algo Recall
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Your personal DSA revision companion
                    </p>
                </div>

                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-semibold text-slate-800">
                        {isSignUp ? "Create Account" : "Welcome Back!"}
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        {isSignUp
                            ? "Sign up to start your revision journey."
                            : "Sign in to continue your revision journey."}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {isSignUp && (
                        <div>
                            <label className="block mb-1 font-medium text-slate-700">
                                Name
                            </label>

                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#315B8C]"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block mb-1 font-medium text-slate-700">
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#315B8C]"
                            required
                        />
                    </div>

                    <div>
                        <label className="block mb-1 font-medium text-slate-700">
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#315B8C]"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#315B8C] text-white px-4 py-2.5 rounded-lg font-medium hover:bg-[#26476D] disabled:opacity-60"
                    >
                        {loading
                            ? (isSignUp ? "Creating Account..." : "Logging in...")
                            : (isSignUp ? "Sign Up" : "Log In")}
                    </button>

                </form>

                <div className="mt-6 text-center text-sm text-slate-600">
                    {isSignUp
                        ? "Already have an account? "
                        : "Don't have an account? "}

                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError("");
                        }}
                        className="font-semibold text-[#315B8C] hover:underline"
                    >
                        {isSignUp ? "Log In" : "Sign Up"}
                    </button>
                </div>

                <p className="mt-6 text-center text-xs text-slate-400">
                    Secure authentication for your DSA journey.
                </p>

            </div>
        </div>
    );
};

export default Login;