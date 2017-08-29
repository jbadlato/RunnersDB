var map;
function initialize() {
	var myLatlng = new google.maps.LatLng(47.6062,-122.3321);
	var myOptions = {
    	zoom: 10,
    	center: myLatlng,
    	mapTypeId: google.maps.MapTypeId.ROADMAP
  	}
  	map = new google.maps.Map(document.getElementById("map"), myOptions);

  	google.maps.event.addListener(map, 'click', function(e) {
    	placeMarker(e.latLng);
  	});

  	var card = document.getElementById('search_bar');
  	var input = document.getElementById('text_input');

  	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);

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

var iconBase = 'https://maps.google.com/mapfiles/kml/shapes/';
function placeMarker(location) {
  var marker = new google.maps.Marker({
      position: location, 
      icon: {
      	path: google.maps.SymbolPath.CIRCLE,
      	scale: 1,
      	strokeColor: "#00F",
      	strokeWeight: 3.0
      },
      map: map
  });
}