var map;
var directionsService;
var directionsDisplay;
function initialize() {
	var myLatlng = new google.maps.LatLng(47.6062,-122.3321);
	var myOptions = {
    	zoom: 17,
    	center: myLatlng,
    	mapTypeId: google.maps.MapTypeId.TERRAIN
  	}
  	map = new google.maps.Map(document.getElementById("map"), myOptions);

  	// Set up directions objects:
  	directionsService = new google.maps.DirectionsService();
  	directionsDisplay = new google.maps.DirectionsRenderer({
  		suppressMarkers: true,
  		preserveViewport: true,
  		polylineOptions: {
  			clickable: false,
  			strokeColor: '#66f',
  			strokeOpacity: 0.75,
  			strokeWeight: 7
  		}
  	});
  	directionsDisplay.setMap(map);

  	// Add listener to add markers to map where user clicks (snaps to nearest road):
  	google.maps.event.addListener(map, 'click', function(e) {
  		var request = {
  			origin: e.latLng,
  			destination: e.latLng,
  			travelMode: google.maps.DirectionsTravelMode.WALKING
  		};

  		directionsService.route(request, function(response, status) {
  			if (status == google.maps.DirectionsStatus.OK) {
  				placeMarker(response.routes[0].legs[0].start_location);
  				calculateAndDisplayRoute();
  			} else {
  				alert('Error placing marker');
  			}
  		})
  	});

  	// Add listener for the autocomplete "jump to location" search bar:
  	var card = document.getElementById('search_bar');
  	var input = document.getElementById('text_input');
  	var distance_display = document.getElementById('distance_display');
  	var undo_button = document.getElementById('undo_button');
  	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);
  	map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(distance_display);
  	map.controls[google.maps.ControlPosition.LEFT_TOP].push(undo_button);
  	var autocomplete = new google.maps.places.Autocomplete(input);
  	autocomplete.bindTo('bounds', map);
  	autocomplete.addListener('place_changed', function() {
  		var place = autocomplete.getPlace();
  		if(!place.geometry) {
  			window.alert("No details available for input: '" + place.name + "'");
  			return;
  		}

  		if (place.geometry.viewport) {
  			map.fitBounds(place.geometry.viewport);
  		} else {
  			map.setCenter(place.geometry.location);
  			map.setZoom(17);
  		}
  	});
}

var markers = []; // stores the marker locations
function placeMarker(location) {
  	var marker = new google.maps.Marker({
      position: location, 
      icon: {
      	path: google.maps.SymbolPath.CIRCLE,
      	scale: 3,
      	strokeColor: "#00F",
      	strokeWeight: 6
      },
      map: map
 	 });
  	markers.push(marker);
}

function deleteLastMarker() {
	var marker = markers.pop();
	marker.setMap(null);
	calculateAndDisplayRoute();
}

function calculateAndDisplayRoute() {
	start = new google.maps.LatLng(markers[0].position.lat(), markers[0].position.lng());
	end = new google.maps.LatLng(markers[markers.length-1].position.lat(), markers[markers.length-1].position.lng());
	ways = [];
	for (var i = 1; i < markers.length-1; i++) {
		newWay = new google.maps.LatLng(markers[i].position.lat(), markers[i].position.lng());
		ways.push({
			location: newWay,
			stopover: true
		});
	}
	directionsService.route({
		origin: start,
		destination: end,
		waypoints: ways,
		optimizeWaypoints: false,
		travelMode: 'WALKING',
		unitSystem: google.maps.UnitSystem.METRIC
	}, function(response, status) {
		if (status === 'OK') {
			directionsDisplay.setDirections(response);
			routeDistance = 0;
			legs = response.routes[0].legs;
			for (var i = 0; i < legs.length; i++) {
				routeDistance += legs[i].distance.value;
			}
			document.getElementById('distance_display').innerHTML = routeDistance/1000 + ' km<hr>' + Math.round(routeDistance/1609.34 * 1000)/1000 + ' mi';
		} else {
			alert('Directions request failed due to ' + status);
		}
	});
}