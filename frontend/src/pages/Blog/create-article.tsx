import React, {useMemo, useState} from 'react';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
import { api } from '../../services/axios-setup'; // Import your Axios instance

const CreateArticle: React.FC = () => {
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');

    const handleContentChange = (value: string) => {
        setContent(value); // Update content as Markdown changes
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/articles', {
                title,
                content,
            });
            alert('Article created successfully!');
        } catch (error) {
            console.error('Error creating article:', error);
            alert('Error creating article');
        }
    };
    const autofocusNoSpellcheckerOptions = useMemo(() => {
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
                    <label className="uk-form-label" htmlFor="content">Content (Markdown):</label>
                    <div className="uk-form-controls">
                        <SimpleMDE
                            value={content}
                            onChange={handleContentChange}
                            options={autofocusNoSpellcheckerOptions}
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
