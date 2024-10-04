const express = require('express');
const app = express();
const userModel = require('./models/user');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config(); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    const token = req.cookies.token; // Get the token from the cookie
    let username = "";

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (!err) {
                username = decoded.username; // Set username if token is valid
            }
        });
    }

    res.render('index', { token, username }); // Pass the token and username to the view
});


app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/cart', (req, res) => {
    res.render('cart');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;
        const user = await userModel.findOne({ username });

        if (!user) {
            return res.render('login', { error: "User not found", username });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.render('login', { error: "Incorrect password", username });
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is not defined!");
            return res.render('login', { error: "Internal server error", username });
        }

        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/');
    } catch (error) {
        console.error("Login error: ", error);
        res.render('login', { error: "Internal server error", username: req.body.username });
    }
});


app.post('/signup', async (req, res) => {
    let { username, email, mnumber, password, cpassword } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;

    if (!emailRegex.test(email)) {
        return res.render('signup', { error: "Please enter a valid email address.", username, email, mnumber });
    }

    if (!phoneRegex.test(mnumber)) {
        return res.render('signup', { error: "Please enter a valid 10-digit mobile number.", username, email, mnumber });
    }

    if (password !== cpassword) {
        return res.render('signup', { error: "Passwords do not match.", username, email, mnumber });
    }

    const check1 = await userModel.findOne({ username });
    const check2 = await userModel.findOne({ email });
    const check3 = await userModel.findOne({ mnumber });

    if (check1) {
        return res.render('signup', { error: "Username not available. Try a different one.", username, email, mnumber });
    }
    if (check2) {
        return res.render('signup', { error: "Email is already in use. Try logging in instead.", username, email, mnumber });
    }
    if (check3) {
        return res.render('signup', { error: "Mobile number is already in use. Try logging in instead.", username, email, mnumber });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const user = await userModel.create({
        username, email, password: hash, cpassword: hash, mnumber
    });

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not defined!");
        return res.render('signup', { error: "Internal server error", username, email, mnumber });
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/login');
});


app.post('/logout', (req, res) => {
    res.cookie('token', '', { maxAge: 0 }); // Clear the cookie
    res.redirect('/'); // Redirect to home page
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
