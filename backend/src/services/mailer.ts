import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros puertos
    auth: {
        user: process.env.SMTP_USER, // Tu usuario SMTP (por ejemplo, correo)
        pass: process.env.SMTP_PASS  // Tu contraseña SMTP
    }
});

// Función para enviar correos
export const sendMail = async (to: string, subject: string, html: string) => {
    const mailOptions = {
        from: `"No Reply" <${process.env.SMTP_USER}>`, // Dirección del remitente
        to, // Dirección del destinatario
        subject, // Asunto del correo
        html, // Contenido del correo en formato HTML
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo enviado: %s', info.messageId);
    } catch (error) {
        console.error('Error enviando el correo:', error);
    }
};
