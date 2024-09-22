import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from "./pages/Home";
import Header from "./components/Header";
import Footer from "./components/Footer";
import {AuthProvider} from "./context/AuthContext";
import PageTitle from "./components/PageTitle";
import {pageRoutes} from "./services/routes";

const App: React.FC = () => {
    return (<AuthProvider>
        <Router>
            <div className="app-container">
                <Header />
                <div className="main-content">
                    <Routes>
                        {pageRoutes.map(({RouteElement, path,title, props}, index)=>( <Route key={index} path={path} element={<>
                            <RouteElement />
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
