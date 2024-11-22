import nodemailer from 'nodemailer'
import config from '../../../config';

const emailSender = async (email, html) => {
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

    const info = await transporter.sendMail({
        from: '"Luminedge mock test" <hrshihab10@gmail.com>', // sender address
        to: email, // list of receivers
        subject: "Reset Password Link", // Subject line
        //text: "Hello world?", // plain text body
        html, // html body
    });

    //console.log("Message sent: %s", info.messageId);
}

export default emailSender;