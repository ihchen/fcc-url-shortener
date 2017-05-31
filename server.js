var express = require('express');
var mongo = require('mongodb').MongoClient;

var app = express();
var dburl = process.env.MONGOLAB_URI || 'mongodb://localhost:27017/test';

// https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
function isURL(str) {
  var pattern = new RegExp('^(http|https):\\/\\/www\\.'+ // protocol
  '[a-z\\d]+\\.[a-z]{2,}'); // domain name
  return pattern.test(str);
}

function getNextURLid(db) {
	// Assumes database has collection called counter with document with _id: "url-shortener"
	var counter = db.collection('counters').findOneAndUpdate(
		{ _id: "url-shortener" }, 
		{ $inc: { seq: 1 } }, 
		{ returnNewDocument: true }
	);

	return counter; // Promise
}


app.use(express.static(__dirname));

app.get('/:shorturl(\\d+)', function(req, res) {
	mongo.connect(dburl, function(err, db) {
		var redirectURL;
		if(err)
			console.log('Unable to connect to mongoDB server. Error:', err);
		else {
			db.collection('url-shortener').findOne({ 
				short_url: parseInt(req.params.shorturl)
			}).then( function(result) {
				if(result)
					res.redirect(result.original_url);
				else
					res.redirect('/');
				db.close();
			}, function(err) {
				res.redirect('/');
				db.close();
			});
		}
	});
});

app.get('/new/*', function(req, res) {
	var param = req.params['0'];

	if(isURL(param)) {
		mongo.connect(dburl, function(err, db) {
			if(err)
				console.log('Unable to connect to mongoDB server. Error:', err);
			else {
				getNextURLid(db).then(function(result) {
					var short_url = result.value.seq;

					db.collection('url-shortener').insertOne({
						original_url: param,
						short_url: short_url
					}).then( function() {
						res.end(JSON.stringify({
							original_url: param,
							short_url: req.protocol + '://' + req.get('host') + "/" + short_url
						}));

						db.close();
					}, function(err) {
						console.log(err);

						db.close();
					});
				}, function(err) {
					console.log(err);

					db.close();
				});
			}
		});
	}
	else {
		res.end(JSON.stringify({
			error: "Invalid URL"
		}));
	}
});

app.get('/', function(req, res) {
	res.sendFile('index.html');
});

app.listen(process.env.PORT || 8000, function() {
	console.log("Connection established");
});