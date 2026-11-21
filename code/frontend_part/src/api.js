import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:3000/api",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");

            if (window.location.pathname !== "/login") {
                window.location.href = "/login";
            }
        }

        return Promise.reject(error);
    }
);

export const loginUser = async (email, password) => {
    const response = await api.post("/auth/login", {
        email,
        password,
    });

    return response.data;
};

export const registerUser = async (name, email, password) => {
    const response = await api.post("/auth/register", {
        name,
        email,
        password,
    });

    return response.data;
};

export default api;