newReviewShown = false;
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

var submitReview = function () {
	var url = document.createElement("a");
	url.href = window.location.href;
	route_id = url.pathname.split('/')[2];
	comment = document.getElementById('comment').value;
	difficulty = getRadioValue('difficulty');
	safety = getRadioValue('safety');
	scenery = getRadioValue('scenery');
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
			} else if (this.responseText === 'Success') {
				document.getElementById('error_message').innerHTML = 'Review submitted.';
			}
		}
	}
}