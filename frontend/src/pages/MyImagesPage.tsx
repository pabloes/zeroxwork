import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ImageGallery from '../components/ImageGallery';
import {useAuth} from "../context/AuthContext";
import {Link} from "react-router-dom"; // Asegúrate de que la ruta esté correcta

const MyImagesPage: React.FC = () => {
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const token = localStorage.getItem('authToken');
    const {isAuthenticated} = useAuth();

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const response = await axios.get('/api/images/get-all', {
                    headers:{
                        'Authorization': `Bearer ${token}`, // Include the token in headers
                    }
                }); // Ajusta el endpoint si es necesario

                setImages(response.data);
                setLoading(false);
            } catch (err) {
                if(err?.response?.data?.message){
                    setError(err.response.data.message);
                }else{
                    setError('Failed to load images.');
                }
                setLoading(false);
            }
        };

        fetchImages();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }
if(!isAuthenticated){
    return  <div className="uk-container"><br/><p>You need to <Link to="/register">Register</Link> or <Link to="/login">Login</Link> to access this page</p></div>;
}
    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className="uk-section uk-section-small">
            <div className="uk-container">
                <div className="uk-container uk-text-center">
                    <Link to={"/image-upload"}>🏞️ Public Image upload</Link>
                </div>
                {images.length > 0 ? (
                    <ImageGallery images={images} />
                ) : (
                    <p>No images uploaded yet.</p>
                )}
            </div>
        </div>
    );
};

export default MyImagesPage;
