import React, {ReactNode, useEffect} from 'react';
import { BrowserRouter as Router, Route, Routes,Navigate } from 'react-router-dom';
import Header from "./components/Header";
import Footer from "./components/Footer";
import {AuthProvider, useAuth} from "./context/AuthContext";
import PageTitle from "./components/PageTitle";
import {pageRoutes} from "./services/routes";

const App: React.FC = () => {
    return (<AuthProvider>
        <Router>
            <div className="app-container">
                <Header />
                <div className="main-content">
                    <Routes>
                        {pageRoutes.map(({RouteElement, path,title, props,auth}, index)=>( <Route  key={index} path={path} element={<>
                            {auth ? <PrivateRoute>
                                    <RouteElement {...props} />
                                </PrivateRoute>
                                : <>
                                    <RouteElement {...props} />
                                </>}
                            <PageTitle title={title} />
                        </>
                        } />))}
                    </Routes>
                </div>
                <Footer/>
            </div>
        </Router>
        </AuthProvider>
    );
};

export default App;

function PrivateRoute({ children }: { children: ReactNode }) {
    const { isAuthenticated, isAuthResolved } = useAuth();
    useEffect(()=>{
        if(isAuthResolved && isAuthenticated !== undefined && !isAuthenticated){
            alert("You need to Register and Login to access this page")
        }
    },[isAuthResolved])
    return (
        (isAuthenticated || !isAuthResolved) ? children : <Navigate to="/login" />
    );
}
