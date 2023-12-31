import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import dotenv from "dotenv/config"

const app = express();
const port = 3000;

const db =new pg.Client({
    host: process.env.POSTGRES_HOST,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    port: process.env.POSTGRES_PORT
})

db.connect();

let bookNotes;

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("index.ejs");
})

app.get("/create", (req, res) => {
    res.render("new_note.ejs");
})

async function getAuthorImage(details) {
    const response = await axios.get(`https://openlibrary.org/search.json`, {
        params: {
            q: details.title,
            fields: "key, author_key, title, author_name",
            limit: 1
        }
    });

    console.log(response.data.docs[0]);
    let authorID = response.data.docs[0].author_key[0];
    let authorName = response.data.docs[0].author_name[0];
    let author_img = `https://covers.openlibrary.org/a/olid/${authorID}-M.jpg`;

    return [author_img, authorName, authorID];
}

async function insertNewBook(book) {
    const result = await db.query("INSERT INTO books (title, description, book_isbn, author_name, author_id, ratings, notes, cover_img, author_img, read_date) VALUES ($1, $2, $3 , $4, $5, $6, $7, $8, $9, $10);", [book.title, book.description, book.book_isbn, book.author_name, book.author_id, book.ratings, book.notes, book.cover_img, book.author_img, book.read_date]);
}

app.post("/create", async(req, res) => {
    try {
        const auth_info = await getAuthorImage(req.body);
        const cover_img = `https://covers.openlibrary.org/b/isbn/${req.body.isbn}-M.jpg`;
        const read_date = new Date();

        const recordData = {
            title: req.body.title,
            description: req.body.description,
            book_isbn: req.body.isbn,
            author_name: auth_info[1],
            author_id: auth_info[2],
            ratings: 0,
            notes: req.body.notes,
            cover_img: cover_img,
            author_img: auth_info[0],
            read_date: read_date
        };

        await insertNewBook(recordData);

        res.redirect(200, '/');

    } catch(error) {
        console.log(error);
    }
})

app.get("/books", async(req, res) => {
    try {
        
    bookNotes = await db.query("SELECT id,title, description, read_date, author_img, cover_img, ratings FROM books ORDER BY id;");
    console.log(bookNotes.rows);
    res.render("books.ejs", { totalBooks: bookNotes.rows});

    } catch(error) {
        console.log(error);
    }
})

async function getSpecificBookNote(id) {
    const result = await db.query("SELECT * FROM books WHERE id=$1", [id]);

    return result.rows[0];
}

app.get("/book", async(req, res) => {
    const thatBook = await getSpecificBookNote(req.query.id);
    res.render("book.ejs", {book: thatBook})
})

async function updateRating(book_id, rating) {
    console.log(book_id);
    const result = await db.query("UPDATE books SET ratings=$2 WHERE id=$1;",[book_id, rating]);
}

app.post("/rate", async(req, res) => {
    try {
        await updateRating(req.query.id, req.body.rate);
        res.status(200);
        res.redirect("/books");


    } catch(error) {
        console.log(error);
        res.redirect('/books');
    }


})

app.post("/delete", async(req, res) => {
    try {
        const result = await db.query("DELETE FROM books WHERE id=$1", [req.query.id]);
        res.status(200);
        res.redirect("/books");
    } catch(error) {
        console.log(error);
        res.status(500);
        res.redirect("/books");

    }
})

app.post("/sort", async(req, res) => {
    try {
    let sortType = req.body.sort;
    switch(sortType) {
        case "rating":
            bookNotes = await db.query("SELECT id,title, description, read_date, author_img, cover_img, ratings FROM books ORDER BY ratings DESC;");
            break;
        
        case "new":
            bookNotes = await db.query("SELECT id,title, description, read_date, author_img, cover_img, ratings FROM books ORDER BY read_date DESC;");
            break;

        case "old":
            bookNotes = await db.query("SELECT id,title, description, read_date, author_img, cover_img, ratings FROM books ORDER BY read_date ASC;");
            break;
    }

    res.render("books.ejs", { totalBooks: bookNotes.rows});

    } catch(error) {
        console.log(error);
        res.redirect("/books");
    }
})

async function getBookNoteContent(book_id) {
    const result = await db.query("SELECT book_isbn, title, description, notes FROM books WHERE id=$1", [book_id]);

    return result.rows[0];
}

app.post("/edit", async(req, res) => {
    
    const oldContent = await getBookNoteContent(req.query.id);

    console.log(oldContent);

    res.render("new_note.ejs", {
        buttonName: "Update",
        method: `/update?id=${req.query.id}`,
        title: oldContent.title,
        description: oldContent.description,
        notes: oldContent.notes,
        isbn: Number(oldContent.book_isbn)
    })

})

async function updateBook(book_id, content) {
    const result = await db.query("UPDATE books SET book_isbn=$1, title=$2, description=$3, notes=$4 WHERE id=$5;", [ content.isbn, content.title, content.description, content.notes, book_id ]);
}

app.post("/update", async(req, res) => {
    try {
        await updateBook(req.query.id, req.body);
        res.redirect(200, "/books");
    } catch(error) {
        console.log(error);
        res.redirect(500, '/books');
    }

})


app.listen(port, () => {
    console.log(`Server is running at port ${port}`);
})