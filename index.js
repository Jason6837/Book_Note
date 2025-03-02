import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import ejs from "ejs";
import axios from "axios";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import methodOverride from "method-override";

const app = express();
const port = 3000;
const _dirname = dirname(fileURLToPath(import.meta.url));

app.set("view engine", "ejs");
app.set("views", path.join(_dirname, "views"));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true}));
app.use(methodOverride("_method"));

const db = new pg.Client({
	user: "postgres",
	host: "localhost",
	database: "books",
	password: "1234",
	port: 5432
});

db.connect();

async function getAllBooks() {
	try {
		const readsResponse = await db.query("SELECT * FROM reads;");
		if (readsResponse.rows.length > 0) {
			return readsResponse.rows;
		}
	} catch (error) {
		console.error(`Error executing query to reads in getAllBooks() function.`, error.stack);
		return [];
	}
}

app.get("/", async (req, res) => {
	const allBooks = await getAllBooks();
	res.render("index.ejs", { books: allBooks });
});

app.get("/create", (req, res) => {
	res.render("new.ejs");
}) ;

app.post("/new", async (req, res) => {
	const book_title = req.body.title;
	const author = req.body.author;
	const isbn = req.body.isbn;
	const ratings = req.body.ratings;
	const genre = req.body.genre;
	const summary = req.body.summary;
	const thoughts = req.body.thoughts;
	const key_takeaways = req.body.key_takeaways;
	const allBooks = await getAllBooks(); 
	//console.log(book_title);
	//console.log(author);
	//console.log(isbn);
	//console.log(ratings);
	//console.log(genre);
	//console.log(summary);
	//console.log(thoughts);
	//console.log(key_takeaways);
	//console.log(allBooks);

	try {
		const readsResponse = await db.query("INSERT INTO reads (book_name, author, isbn, ratings, genre, summary, thoughts, key_takeaways) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;", [book_title, author, isbn, ratings, genre, summary, thoughts, key_takeaways]);
		if (readsResponse.rows.length > 0) {
			//console.log(readsResponse);
			res.redirect("/");
		}
	} catch (error) {
		console.error("Error executing query to books in the /new route.", error.stack);
		/*
		res.render("index.ejs", {
			books: books,
			error: `This book already exists in the database. Please try other books.`
		});
		*/
	}
});

app.get("/search", async (req, res) => {
	const search = req.query.search;
	const allBooks = await getAllBooks();
	//console.log(search);
	if (search) {
		try {
			const readsResponse = await db.query("SELECT * FROM reads WHERE LOWER (book_name) LIKE '%' || $1 || '%';", [ search.toLowerCase() ]);
			if (readsResponse.rows.length > 0) {
				if (readsResponse.rows.length === 1) {
					//console.log(readsResponse.rows);
					res.render("review.ejs", {
						book: readsResponse.rows[0]
					});
				} else if (readsResponse.rows.length > 1) {
					res.render("multiple.ejs", {
						books: readsResponse.rows
					});
				}
			} else {
				return res.render("index.ejs", {
					books: allBooks,
					error: `No books found matching "${search}". Please try again.`
				});
			}
		} catch (error) {
			console.error(`Error executing query to reads in /search route.`, error.stack);
			res.render("index.ejs", {
				books: allBooks,
				error: `The inputted book does not exist or have yet to be registered in the database. Please try again.`
			});		
		}
	}
});

app.post("/sort", async (req, res) => {
	console.log(req.body);
	
	let allBooks = await getAllBooks();

	try {
		if (req.body.alphabet) {
			const readsResponse = await db.query("SELECT * FROM reads ORDER BY book_name ASC;");
			allBooks = readsResponse.rows; // Replace books with sorted results
		} else if (req.body.ratings) {
			const readsResponse = await db.query("SELECT * FROM reads ORDER BY ratings DESC;");
			allBooks = readsResponse.rows;
		} else if (req.body.fiction) {
			const readsResponse = await db.query("SELECT * FROM reads WHERE genre = $1 ORDER BY book_name ASC;", ['Fiction']);
			allBooks = readsResponse.rows;
		} else if (req.body.nonFiction) {
			const readsResponse = await db.query("SELECT * FROM reads WHERE genre = $1 ORDER BY book_name ASC;", ['Non-fiction']);
			allBooks = readsResponse.rows;
		} else if (req.body.autobiography) {
			const readsResponse = await db.query("SELECT * FROM reads WHERE genre = $1 ORDER BY book_name ASC;", ['Autobiography']);
			allBooks = readsResponse.rows;
		} else if (req.body.selfHelp) {
			const readsResponse = await db.query("SELECT * FROM reads WHERE genre = $1 ORDER BY book_name ASC;", ['Self-help']);
			allBooks = readsResponse.rows;
		}
	} catch (error) {
		console.error("Error executing query in /sort route.", error.stack);
	}

	res.render("index.ejs", { books: allBooks });
});


app.get("/book/:id", async (req, res) => {
	const bookId = parseInt(req.params.id);
	const allBooks = await getAllBooks();
	const selectedBook = allBooks.find(book => book.id === bookId);
	if (!selectedBook) {
		console.log(`Unable to find the book with the id of ${ bookId } in the database.`);
		res.render("index.ejs", {
			books: allBooks,
			error: `The book selected does not exist in the database. Please try again.`
		});
	} else {
		res.render("review.ejs", { 
			book: selectedBook,
		});
	}
});

app.get("/edit/:id", async (req, res) => {
	const bookId = parseInt(req.params.id);
	const allBooks = await getAllBooks();
	const selectedBook = allBooks.find(book => book.id === bookId);
	if (!selectedBook) {
		console.log(`Unable to find book with the id of ${ bookId } in the database.`);
		res.render("index.ejs", {
			books: allBooks,		
			error: `Unable to find the book to be editted in the database. Please try again.`
		});
	} else {
		res.render("edit.ejs", { book: selectedBook });
	}
});

app.post("/update/:id", async (req, res) => {
	const bookId = parseInt(req.params.id);
	const allBooks = await getAllBooks();
	const selectedBook = allBooks.find(book => book.id === bookId);
	if (!selectedBook) {
		console.log(`Unable to find the book with the id of ${ bookId } in the database.`);
		res.render("index.ejs", { 
			books: allBooks,
			error: `Unable to find the book to be editted in the database. Please try again.`
		});
	} else {
		const book_name = req.body.title || selectedBook.title;
		const author = req.body.author || selectedBook.author;
		const isbn = req.body.isbn || selectedBook.isbn;
		const genre = req.body.genre || selectedBook.genre;
		const ratings = req.body.ratings ?? selectedBook.ratings;
		const summary = req.body.summary || selectedBook.summary;
		const thoughts = req.body.thoughts || selectedBook.thoughts;
		const key_takeaways = req.body.key_takeaways || selectedBook.key_takeaways;
		try {
			const readsResponse = await db.query("UPDATE reads SET book_name = $1, author = $2, isbn = $3, ratings = $4, summary = $5, genre = $6, thoughts = $7, key_takeaways = $8 WHERE id = $9 RETURNING *;", [book_name, author, isbn, ratings, summary, genre, thoughts, key_takeaways, bookId]);
			if (readsResponse.rows.length > 0) {
				//console.log(readsResponse.rows);
				res.redirect("/");
			}
		} catch (error) {
			console.error(`Error executing query to reads in /update route.`, error.stack);
			res.render("index.ejs", {
				books: allBooks,
				error: `Error in updating existing book details. Please try again.`
			});
		}
	}
});

app.post("/delete/:id", async (req, res) => {
	const bookId = parseInt(req.params.id);
	const allBooks = await getAllBooks();
	const selectedBook = allBooks.find(book => book.id === bookId);
	if (!selectedBook) {
		res.render("index.ejs", { 
			books: allBooks, 
			error: `The book does not exist. No book has been deleted.` 
		});
	} else {
		try {
			const readsResponse = await db.query("DELETE FROM reads WHERE id = $1;", [bookId]);
			res.redirect("/");
		} catch (error) {
			console.error(`Error executing query to reads in /delete route.`, error.stack);
			res.render("index.ejs", { 
				books: allBooks,
				error: `Unable to delete the book selected. Please try again.`
			});
		}	
	}
});

app.listen(port, () => {
	console.log(`Server running on port ${ port }.`);
});