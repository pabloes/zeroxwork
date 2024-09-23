import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";

interface AuthContextType {
    user: any;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    contextTitle:string;
    setContextTitle:Function;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<any>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [contextTitle, setContextTitle] = useState<string>("")
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
    }, []);

    const login = async (email: string, password: string) => {
        try {
            // Send login request to the backend and receive the JWT
            const response = await axios.post('/api/auth/login', { email, password });

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

    const logout = () => {
        // Remove the token from localStorage
        localStorage.removeItem('authToken');
        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, login, logout, contextTitle, setContextTitle }}>
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
