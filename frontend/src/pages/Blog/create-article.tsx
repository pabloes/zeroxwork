import React, { useState, useMemo } from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { api } from '../../services/axios-setup'; // Import your Axios instance
import {useNavigate} from 'react-router-dom';
import UIkit from "uikit";

const CreateArticle: React.FC = () => {
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [thumbnail, setThumbnail] = useState<string>(''); // Nuevo estado para la URL del thumbnail
    const navigate = useNavigate();

    // Manejar el cambio en el contenido del artículo
    const handleContentChange = (value: string) => {
        setContent(value);
    };

    // Manejar la subida del artículo
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/blog/articles', {
                title,
                content,
                thumbnail, // Enviar también el thumbnail al backend
            });
            debugger;
            UIkit.notification(``, `success`)
            navigate(`/view-article/${response.data.data.id}`)
        } catch (error) {
            console.error('Error creating article:', error);
            UIkit.notification(`Error creating article`, `error`)
        }
    };

    // Memoize the options for SimpleMDE to avoid losing focus
    const editorOptions = useMemo(() => {
        return {
            placeholder: "Write your content...",
            spellChecker: false,
        } as SimpleMDE.Options;
    }, []);

    return (
        <div className="uk-container uk-margin-large-top">
            <form className="uk-form-stacked" onSubmit={handleSubmit}>
                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="title">Title:</label>
                    <div className="uk-form-controls">
                        <input
                            className="uk-input"
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="Enter article title"
                        />
                    </div>
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="thumbnail">Thumbnail URL:</label>
                    <div className="uk-form-controls">
                        <input
                            className="uk-input"
                            id="thumbnail"
                            type="url"
                            value={thumbnail}
                            onChange={(e) => setThumbnail(e.target.value)} // Actualizar el estado del thumbnail
                            placeholder="Enter image URL"
                        />
                    </div>

                    {/* Mostrar la vista previa de la imagen si la URL es válida */}
                    {thumbnail && (
                        <div className="uk-margin">
                            <img
                                src={thumbnail}
                                alt="Thumbnail preview"
                                style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                                onError={() => setThumbnail('')} // Si la URL es inválida, limpiamos el estado del thumbnail
                            />
                        </div>
                    )}
                </div>

                <div className="uk-margin">
                    <label className="uk-form-label" htmlFor="content">Content (Markdown):</label>
                    <div className="uk-form-controls">
                        <SimpleMDE
                            value={content}
                            onChange={handleContentChange}
                            options={editorOptions}
                        />
                    </div>
                </div>

                <div className="uk-margin">
                    <button className="uk-button uk-button-primary" type="submit">
                        Submit
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateArticle;
