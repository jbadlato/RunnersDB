var newReviewShown = false;
var toggleNewReview = function () {
	if (newReviewShown) {
		document.getElementById('new_review_container').style = "display: none;";
		newReviewShown = false;
	} else {
		document.getElementById('new_review_container').style = "display: block;";
		newReviewShown = true;
	}
}

var getRadioValue = function(elementId) {
	var selector = document.getElementsByName(elementId);
	var value;
	for (var i = 0; i < selector.length; i++) {
		if (selector[i].checked) {
			value = selector[i].value;
			break;
		}
	}
	return value;
}

var ratingToStars = function (rating) {
	var stars = '';
	for (var i = 0; i < 5; i++) {
		if (i < rating) {
			stars += '&#x2605';
		} else {
			stars += '&#x2606';
		}
	}
	return stars;
}

var submitReview = function () {
	var url = document.createElement("a");
	url.href = window.location.href;
	var route_id = url.pathname.split('/')[2];
	var comment = document.getElementById('comment').value;
	var difficulty = getRadioValue('difficulty');
	var safety = getRadioValue('safety');
	var scenery = getRadioValue('scenery');
	if (difficulty === undefined || safety === undefined || scenery === undefined) {
		document.getElementById('error_message').innerHTML = 'Please rate the route in each of the three categories.';
		return;
	} else {
		document.getElementById('error_message').innerHTML = ''
	}
	var params = {
		// get username server side
		'route_id': route_id,
		'comment': comment,
		'difficulty': difficulty,
		'safety': safety,
		'scenery': scenery
	};
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "/submitReview");
	xhttp.setRequestHeader("Content-Type", "application/json");
	xhttp.send(JSON.stringify(params));
	xhttp.onreadystatechange = function () {
		if (this.readyState === 4 && this.status === 200) {
			if (this.responseText === 'Sign In') {
				window.location = window.location.origin + "/sign_in";
			} else if (this.responseText === 'Duplicate') {
				document.getElementById('error_message').innerHTML = 'You have already submitted a review for this route.';
			} else if (this.responseText === 'Success') {
				document.getElementById('error_message').innerHTML = 'Review submitted.';
			}
		}
	}
}

var createReview = function (row) {
	review = "<li id='review'>" + row.username +" [" + row.upvotes + "]<button id='upvote' onclick=upvote(" + row.comment_id + ")>&#x21E7</button>" +
		"<ul id='review_content'>" + 
		"<li><h3>" + row.comment + "</h3></li>" + 
		"<li>Difficulty: " + ratingToStars(row.difficulty) + "</li>" + 
		"<li>Safety: " + ratingToStars(row.safety) + "</li>" +
		"<li>Scenery: " + ratingToStars(row.scenery) + "</li>" + 
		"</ul>" +
	    "</li>";
	return review;
}

var page = 1;
var buildReviews = function () {
	if (page === 1) {
		document.getElementById('prev_button').style = "display: none;";
	} else {
		document.getElementById('prev_button').style = "display: inline-block;";
	}
	var url = document.createElement("a");
	url.href = window.location.href;
	var route_id = window.location.pathname.split('/')[2];
	var params = {
		'routeId': route_id,
		'page': page
	};
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "/reviews");
	xhttp.setRequestHeader("Content-Type", "application/json");
	xhttp.send(JSON.stringify(params));
	xhttp.onreadystatechange = function () {
		if (this.readyState === 4 && this.status === 200) {
			rows = JSON.parse(this.responseText);
			if (rows.length < 5) {
				document.getElementById('next_button').style = "display: none;";
			} else {
				document.getElementById('next_button').style = "display: inline-block;";
			}
			reviewsContainer = document.getElementById('reviews_container');
			reviewsContainer.innerHTML = '';
			for (var i = 0; i < rows.length; i++) {
				reviewsContainer.innerHTML += createReview(rows[i]);
			}
		}
	}
}

var showReviews = function () {
	buildReviews();
}

var nextPage = function () {
	page++;
	buildReviews();
}

var prevPage = function () {
	page--;
	buildReviews();
}

var upvote = function (comment_id) {
	var xhttp = new XMLHttpRequest();
	xhttp.open("POST", "/upvote");
	xhttp.setRequestHeader("Content-Type", "application/json");
	xhttp.send(JSON.stringify({'comment_id': comment_id}));
	xhttp.onreadystatechange = function () {
		if (this.readyState === 4 && this.status === 200) {
			if (this.responseText === 'Sign In') {
				window.location = window.location.origin + "/sign_in";
			} else if (this.responseText === 'Duplicate') {
				alert('You have already upvoted this review.');
			} else if (this.responseText === 'Success') {
				buildReviews();
			}
		}
	}
}

