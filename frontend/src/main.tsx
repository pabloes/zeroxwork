import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Register from './pages/Register';
import 'uikit/dist/css/uikit.min.css'; // UIkit CSS
import './styles/main.scss'; // Tus estilos personalizados
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
    <Router>
        <Header />
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} /> {/* Ruta de Registro */}
            {/* Puedes agregar más rutas aquí */}
        </Routes>
        <Footer />
    </Router>
);
