import axios from "axios";

const api = axios.create({
    baseURL: "/",
    withCredentials: true, // send the session cookie with requests
});

export default api;