import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";
import {api} from "../services/axios-setup";

interface AuthContextType {
    user: any;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    /** Swaps the session token for a new one the server handed out. */
    replaceToken: (token: string) => void;
    isAuthResolved:boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<any>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isAuthResolved, setIsAuthResolved] = useState<boolean>(false);
    // Load user from localStorage if available
    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const decodedUser:any = jwtDecode(token); // Decode the JWT
                setUser(decodedUser);
                if((decodedUser?.exp * 1000) < Date.now()){
                    setIsAuthenticated(false);
                }else{
                    setIsAuthenticated(true);
                }

            } catch (error) {
                console.error('Invalid token', error);
                localStorage.removeItem('authToken'); // Remove invalid token
            }
        }
        setIsAuthResolved(true);
    }, []);

    const login = async (email: string, password: string) => {
        try {
            // Send login request to the backend and receive the JWT
            const response = await api.post('/auth/login', { email, password });

            // Extract the JWT from the response
            const { token } = response.data;

            // Store the token in localStorage (or cookies)
            localStorage.setItem('authToken', token);

            // Decode the token to get user information
            const decodedUser = jwtDecode(token);
            setUser(decodedUser);
            setIsAuthenticated(true);
        } catch (error) {
            console.error('Login failed', error);
            throw error; // Re-throw the error to be handled in the component
        }
    };

    // The server signs every session out when the password changes and answers
    // with a fresh token for the one that asked: this keeps that one alive.
    const replaceToken = (token: string) => {
        // Decoded first: a malformed token throws here, before it replaces a good one.
        const decodedUser = jwtDecode(token);
        localStorage.setItem('authToken', token);
        setUser(decodedUser);
        setIsAuthenticated(true);
    };

    const logout = () => {
        // Remove the token from localStorage
        localStorage.removeItem('authToken');
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, login, logout, replaceToken, isAuthResolved }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
