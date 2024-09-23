// ConfirmActionModal.tsx
import React, { useState, useEffect } from 'react';
import UIkit from 'uikit';

interface ConfirmActionModalProps {
    show: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    wordToType?: string;
    imageSrc?: string; // Nueva prop para la imagen opcional
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
                                                                   show,
                                                                   onClose,
                                                                   onConfirm,
                                                                   title,
                                                                   message,
                                                                   confirmButtonText = 'Confirm',
                                                                   cancelButtonText = 'Cancel',
                                                                   wordToType,
                                                                   imageSrc, // Recibir la URL de la imagen
                                                               }) => {
    const [confirmationText, setConfirmationText] = useState('');

    useEffect(() => {
        if (!show) setConfirmationText('');
    }, [show]);

    const handleConfirm = () => {
        if (!wordToType || confirmationText === wordToType) {
            onConfirm();
            onClose();
        } else {
            UIkit.notification({ message: `Please type "${wordToType}" to confirm.`, status: 'warning' });
        }
    };

    return (
        <div id="confirm-action-modal" className={`uk-modal ${show ? 'uk-open' : ''}`} style={{ display: show ? 'block' : 'none' }}>
            <div className="uk-modal-dialog uk-modal-body">
                <h2 className="uk-modal-title">{title}</h2>
                <p>{message}</p>
                {imageSrc && (
                    <div className="uk-margin">
                        <img src={imageSrc} alt="Image to be deleted" className="uk-thumbnail" style={{ width: '100%', maxHeight: '300px', objectFit: 'contain' }} />
                    </div>
                )}
                {wordToType && (
                    <input
                        className="uk-input"
                        type="text"
                        value={confirmationText}
                        onChange={(e) => setConfirmationText(e.target.value)}
                        placeholder={`Type "${wordToType}" to confirm`}
                    />
                )}
                <div className="uk-margin-top">
                    <button className="uk-button uk-button-default uk-margin-right" onClick={onClose}>
                        {cancelButtonText}
                    </button>
                    <button className="uk-button uk-button-danger" onClick={handleConfirm}>
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmActionModal;
