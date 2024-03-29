const express = require('express');
const exphbs = require('express-handlebars').create();
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
const mongoose = require('./dao/db');
const Message = require('./dao/models/MessageModel');
const Cart = require('./dao/models/CartModel');
const Product = require('./dao/models/ProductModels');
const messageRoutes = require('./routes/messageRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const jwt = require('jsonwebtoken');
const router = express.Router();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const ProductManager = require('./dao/models/ProductManager');
const productManager = new ProductManager(path.join(__dirname, 'data', 'products.json'));

// Configuración de Handlebars
app.engine('handlebars', exphbs.engine);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware para servir archivos estáticos (styles, scripts, etc.)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/scripts', express.static(path.join(__dirname, 'public', 'scripts')));

// Middleware para procesar JSON en las solicitudes
app.use(express.json());

// Configuración de sesiones
app.use(session({
    secret: 'secreto',
    resave: false,
    saveUninitialized: false
}));

// Inicialización de Passport
app.use(passport.initialize());
app.use(passport.session());

// Configuración de Passport para autenticación local
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, (email, password, done) => {
    // Aquí va la lógica para autenticar al usuario utilizando Mongoose o cualquier otra forma
}));

// Serialización y deserialización del usuario para la sesión
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // Aquí va la lógica para encontrar al usuario por su ID
});

// Rutas
app.use('/messages', messageRoutes);
app.use('/products', productRoutes);
app.use('/carts', cartRoutes);

// Ruta para el formulario de registro
app.get('/register', (req, res) => {
    res.render('register');
});

// Ruta para procesar el registro de usuario
app.post('/register', (req, res) => {
    // Aquí va la lógica para registrar al usuario en la base de datos
});

// Ruta para el formulario de inicio de sesión
app.get('/login', (req, res) => {
    res.render('login');
});

// Ruta para procesar el inicio de sesión
app.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
}));

// Middleware para verificar si el usuario está autenticado
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

// Ruta principal
app.get('/', isAuthenticated, (req, res) => {
    // Aquí puedes mostrar la vista principal con los datos del usuario autenticado
});

// Inicio del servidor
const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Manejo de conexiones con Socket.io
io.on('connection', async (socket) => {
    console.log('Usuario conectado');

    // Manejar mensajes de chat entrantes
    socket.on('chatMessage', async (message) => {
        try {
            // Guardar el mensaje en la base de datos
            const newMessage = new Message({ user: message.user, message: message.message });
            await newMessage.save();

            // Emitir el mensaje a todos los clientes conectados
            io.emit('chatMessage', newMessage);
        } catch (error) {
            console.error('Error al guardar el mensaje:', error.message);
        }
    });

    // Obtener la lista inicial de productos y emitirla al cliente
    try {
        const initialProducts = await productManager.getAllProducts();
        socket.emit('initialProducts', initialProducts);
    } catch (error) {
        console.error('Error obteniendo productos iniciales:', error.message);
    }

    // Manejar la desconexión del usuario
    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });

    // Manejar la solicitud para agregar un nuevo producto
    socket.on('addProduct', async (newProduct) => {
        try {
            // Agregar el nuevo producto utilizando el ProductManager
            const addedProduct = await productManager.addProduct(newProduct);

            // Emitir la lista actualizada de productos al cliente
            io.emit('productUpdated', { products: await productManager.getAllProducts() });
        } catch (error) {
            // Manejar el error, por ejemplo, emitir un mensaje de error al cliente
            console.error('Error adding product:', error.message);
            socket.emit('addError', error.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

module.exports = router;