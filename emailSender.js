const nodemailer = require('nodemailer');

const emailSender = async (to, content) => {
    console.log(process.env.EMAIL);
    console.log(process.env.APP_PASS);

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
            user: process.env.EMAIL,
            pass: process.env.APP_PASS,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const mailOptions = {
        from: process.env.EMAIL,
        to: to,
        subject: 'Luminedge mock test password reset link',
        html: content
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
};

module.exports = { emailSender };