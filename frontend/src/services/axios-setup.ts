// frontend/src/services/axiosSetup.ts
import axios from 'axios';

// Crear instancia de axios
const api = axios.create({
    baseURL: '/api', // Ajusta esto según la base de tu API
});


// Añadir interceptor para incluir el token en cada solicitud
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken'); // Suponiendo que almacenas el token en localStorage
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export {api};
