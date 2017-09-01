/*
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname));

// views is directory for all template files
app.set('views', __dirname);
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('index');
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
*/

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var bodyParser = require('body-parser');

// Start server:
app.set('port', process.env.PORT || 5000);
server.listen(app.get('port'), function () {
	console.log('Server is running on port ' + app.get('port'));
});

app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

// Set up sqlite3 database:
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('runners.db');
db.serialize(function() {
	db.run("CREATE TABLE IF NOT EXISTS logins (id INTEGER PRIMARY KEY, username TEXT, password TEXT)");
	db.run("CREATE TABLE IF NOT EXISTS form_data (id INTEGER PRIMARY KEY, username TEXT, routename TEXT, location TEXT, distance TEXT)");
})
db.close();

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/views/home.html');
});

app.post('/new_user', function(req, res) {
	db = new sqlite3.Database('runners.db');
	if (req.body.password !== req.body.password2) {
		// passwords don't match
	} else {
		db.all("SELECT * FROM logins WHERE username = ?", [req.body.username], function (err, rows) {
			console.log(rows);
			console.log("'" + req.body.username + "'");
			if (rows.length > 0) {
				// username already taken
			} else {
				db.run("INSERT INTO logins (username, password) VALUES (?, ?)", [req.body.username, req.body.password]);
				db.close();
			}
		})
	}
})

var submit_route = require('./views/submit_route.js');
app.post('/submit_route', function(req, res) {
	submit_route(req, res);
});