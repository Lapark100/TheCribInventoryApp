import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();


const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: process.env.DATABASE_NAME,
    password: process.env.DATABASE_PASSWORD,
    port: 5432,
});

db.connect();

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"))

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }, 
}));

app.use(passport.initialize());
app.use(passport.session());


let currentUserId = 1;

let users = [
    { id: 1, first_name: "Guest" },
];

let products;

async function getProducts() {
    const result = await db.query("SELECT * FROM products");

    products = result.rows;
    return products;
}

async function getCurrentUser() {
    const result = await db.query("SELECT * FROM users ");
    users = result.rows;
    return users.find((users) => users.id == currentUserId)
}

app.get("/", (req, res) => {
    res.render("login.ejs")
})

app.get("/home", async (req, res) => {
    console.log(req.user)
    const currentUser = await getCurrentUser();
    const products = await getProducts();
    if (req.isAuthenticated()) {
        res.render("index.ejs", {
            noUsers: users.length,
            users: users,
            products: products
        })
    } else {
        res.redirect("/login")
    }
   
})

app.get("/signup", (req, res) => {
    res.render("signup.ejs")
})

app.get("/login", (req, res) => {
    res.render("login.ejs")
})
app.get("/add-products", (req, res) => {
    res.render("add-products.ejs")
})

app.get("/products", async (req, res) => {

    const currentUser = await getCurrentUser();

    const category = req.query.category
    const result = await db.query("SELECT * FROM products WHERE category = $1;", [category]);

    const products = result.rows;

    res.render("products.ejs", {
        noUsers: users.length,
       
        users: users,
        products: products
    })
})

app.post("/signup", (req, res) => {
    if (req.body.add === "signup") {
        res.render("signup.ejs")
    } else {
        res.redirect("/home")
    }

})

app.post("/login", (req, res) => {
    if (req.body.add === "login") {
        res.render("login.ejs")
    } else {
        res.redirect("/home")
    }

})



app.post("/new", async (req, res) => {
    const fname = req.body["f_name"];
    const lname = req.body["l_name"]
    const e_mail = req.body["e-mail"]
    const password = req.body["password"]
    const userType = req.body["userType"]

    try {
        const checkEmail = await db.query("SELECT * FROM users WHERE email = $1",
            [e_mail]
        );

        if (checkEmail.rows.length > 0) {
            res.send("Email already exists")
        } else {
            //hashing the password and saving it in the database
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.error("Error hashing password:", err);
                } else {
                    //Insert into users table
                    const result = await db.query("INSERT INTO users (first_name, last_name, email, password_hash, user_role) VALUES($1, $2, $3, $4, $5) RETURNING *",

                        [fname, lname, e_mail, hash, userType]
                    )

                    const user = result.rows[0]
                    const id = result.rows[0].id;
                    currentUserId = id;
                    
                    req.login(user, (err) => {
                        console.log(err)
                        res.redirect('/home')
                    })
                }
            })
            
            

        }
    } catch (error) {
        console.log(error)
    }
});

app.post("/auth", passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login"
}))

app.post("/new-product", async (req, res) => {

    const product_name = req.body["name"]
    const quantity = req.body["quantity"]
    const cost_price = req.body["cost_price"]
    const category = req.body["category"]

    const result = await db.query("INSERT INTO products (name, quantity, cost_price, category) VALUES ($1, $2, $3, $4) RETURNING *",

        [product_name, quantity, cost_price, category]

    )

    res.redirect("/products")

})

passport.use(new Strategy( async function verify(username, password, cb){

    try {
        
        const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);

        if(result.rows.length > 0) {
            const user = result.rows[0];
            const password_data = result.rows[0].password_hash;
            bcrypt.compare(password, password_data, (err, result) => {
                if (err) {
                  return cb(err);
                } else {
                    // User exists
                    if (result) {
                        return cb(null, user)
                        re;
                    } else {
                        // User does not exist
                       return cb(null, false)
                    }
                }
            });
        } else {
            return cb("User not found")
        }

    } catch (err) {
      return cb(err)
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user)
});

passport.deserializeUser((user, cb) => {
    cb(null, user)
});

app.listen(port, () => {
    console.log(`Server is running at port ${port}`)
})