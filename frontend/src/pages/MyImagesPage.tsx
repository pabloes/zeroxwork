import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ImageGallery from '../components/ImageGallery';
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import UIkit from "uikit";
import ConfirmActionModal from '../components/ConfirmActionModal';
import {api} from "../services/axios-setup"; // Asegúrate de que la ruta esté correcta

const MyImagesPage: React.FC = () => {
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [imageToDelete, setImageToDelete] = useState<any | null>(null); // Cambiar a objeto para almacenar la imagen completa

    const token = localStorage.getItem('authToken');
    const { isAuthenticated } = useAuth();

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/images/${id}`);
            // Filtra la imagen eliminada
            setImages((prevImages) => prevImages.filter((image) => image.id !== id));
            UIkit.notification({ message: `File deleted`, status: 'success' });
        } catch (err) {
            setError('Failed to delete image.');
        }
    };

    const openDeleteModal = (image: any) => {
        setImageToDelete(image); // Almacenar el objeto de la imagen completa
        setShowModal(true);
    };

    const closeDeleteModal = () => {
        setShowModal(false);
        setImageToDelete(null);
    };

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const response = await api.get('/images/get-all'); // Ajusta el endpoint si es necesario

                setImages(response.data);
                setLoading(false);
            } catch (err:any) {
                if (err?.response?.data?.message) {
                    setError(err.response.data.message);
                } else {
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
    if (!isAuthenticated) {
        return <div className="uk-container"><br /><p>You need to <Link to="/register">Register</Link> or <Link to="/login">Login</Link> to access this page</p></div>;
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
                    <ImageGallery images={images} onDelete={openDeleteModal} />
                ) : (
                    <p>No images uploaded yet.</p>
                )}
            </div>
            {imageToDelete && (
                <ConfirmActionModal
                    show={showModal}
                    onClose={closeDeleteModal}
                    onConfirm={() => {
                        if (imageToDelete) {
                            handleDelete(imageToDelete.id);
                        }
                    }}
                    title="Confirm Deletion"
                    message="Are you sure you want to delete this image? This action cannot be undone."
                    confirmButtonText="Delete"
                    cancelButtonText="Cancel"
                    wordToType="delete"
                    imageSrc={imageToDelete.fileUrl} // Pasar la URL de la imagen a eliminar
                />
            )}
        </div>
    );
};

export default MyImagesPage;
