import React, {ReactNode, useEffect} from 'react';
import { BrowserRouter as Router, Route, Routes,Navigate } from 'react-router-dom';
import Header from "./components/Header";
import Footer from "./components/Footer";
import {AuthProvider, useAuth} from "./context/AuthContext";
import {LanguageProvider} from "./i18n/LanguageProvider";
import {useTranslation} from "./i18n";
import {pageRoutes} from "./services/routes";

const App: React.FC = () => {
    return (<LanguageProvider>
        <AuthProvider>
        <Router>
            <div className="app-container">
                <Header />
                <div className="main-content">
                    <Routes>
                        {pageRoutes.map(({RouteElement, path, props, auth}, index)=>( <Route  key={index} path={path} element={<>
                            {auth ? <PrivateRoute>
                                    <RouteElement {...props} />
                                </PrivateRoute>
                                : <>
                                    <RouteElement {...props} />
                                </>}
                        </>
                        } />))}
                    </Routes>
                </div>
                <Footer/>
            </div>
        </Router>
        </AuthProvider>
        </LanguageProvider>
    );
};

export default App;

function PrivateRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isAuthResolved } = useAuth();
    const { t } = useTranslation();
    useEffect(()=>{
        if(isAuthResolved && isAuthenticated !== undefined && !isAuthenticated){
            alert(t("auth.login_required"))
        }
    },[isAuthResolved])
    return (
        (isAuthenticated || !isAuthResolved) ? children : <Navigate to="/login" />
    );
}
