var sqlite3 = require('sqlite3');

module.exports = function(req, res) {
	var db = new sqlite3.Database('routes.db');
	console.log('Trying to add form data to database...');
	console.log(req.body);
	db.run("INSERT INTO form_data (username, routename, location, distance) VALUES (?, ?, ?, ?)", [req.body.username, req.body.routename, req.body.location, req.body.distance]);
	console.log('Inserted row.');
	db.close();
};