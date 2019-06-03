var imageIndex;
var locationArray = new Array;
var timerId;
var time = 0;
var player1Input = '';
var imageDetails = '';
var imageNumber = '';
var popupStatus = 0;

$(document).ready(function() {
	$('#assignmentId').val(gup('assignmentId'));
	//console.log('Assignment id is ' + $('#assignmentId').val());
	if(gup('assignmentId') == 'ASSIGNMENT_ID_NOT_AVAILABLE') {
		loading();
		setTimeout(function() {
			loadPopup();
		}, 500);
	}
	else {
		$('#workerId').val(gup('workerId'));
		var form = $('#turkForm');
		if(document.referrer && (document.referrer.indexOf('workersandbox') != -1)) {
			form.action = 'http://workersandbox.mturk.com/mturk/externalSubmit';	
		}	
	}

	timerId = setInterval(countdown, 1000);
	setupTurn1();

	$('#textBox').keydown(function(event) {
		if(event.which == 13) {
			event.preventDefault();
			enterText();
		}
	});
});

function setupTurn1() {
	turn1Visibility();
	if(gup('assignmentId') == 'ASSIGNMENT_ID_NOT_AVAILABLE') {
		$('#mainImage').attr('src', 'img/loadScreen.jpg')
	}
	else
		getTurn1Image();
}

function turn1Visibility() {
	var textBoxDiv = $('#container');
    var textBox = $('#textBox');
    var submitButton = $('#submitButton');
    var expression = $('#expression');
    var directions = $('#directions');
    var rightWrong = $('#rightWrong');

    textBoxDiv.css('visibility', 'visible');
    textBox.css('visibility', 'visible');
    expression.html('Enter a description:');
    directions.html('Enter a description for the object bounded by the red box.');
    rightWrong.css('visibility', 'hidden');
}


//Get the image details
function getTurn1Image() {
	var img = $('#mainImage');
	img.attr('alt', 'Next image.');

	$.ajax({
	    type: 'GET',
	    url: '/turkP1Image',
	    dataType: 'json',
	    success: function(data) {
	        imageDetails = data.imageString;
	        imageIndex = data.imageIndex; 
	        imageNumber = imageDetails.split(',')[0];
	        for(var j = 0; j < 4; j++) {
	            locationArray[j] = imageDetails.split(",")[j+1];
	            //console.log("Location array for " + imageDetails + " is " + locationArray[j]);
	        }
	        var imageNumberInput = $('#imageNumberInput');
	        imageNumberInput.val(imageNumber);
	        var imageNumberP1 = 'ImagesP1/' + imageNumber;
	        //console.log('imageNumberP1 is ' + imageNumberP1);
	        img.attr('src', imageNumberP1);
	    },
	    error: function(xhr, ajaxOptions, thrownError) {
	         alert('Sorry, an error occured while trying to contact the server for turkP1Image.\n' +
	                xhr.responseText + ajaxOptions + thrownError);
	    }
 	});
}


function enterText() {
    var textBox = $('#textBox');
    player1Input = textBox.val();
    $('#expression').html(player1Input);
    textBox.val('');

    if(player1Input == '') {
        alert('You must enter text.');
    }
    else {
	   var timeDisplay = $('#timeDisplay');
	   time = 0;
	   clearInterval(timerId);
	   timeDisplay.html('0');
       submitExpression(player1Input);
    }
}

function submitExpression(player1Input) {
	//console.log('Inside submitExpression. Details: ' + imageDetails + 'expression: ' + player1Input + 'imageNumber: ' + imageNumber);
	var expressionInput = $('#expressionInput');
	var imageDetailsInput = $('#imageDetailsInput');
	var workerId = $('#workerId').val();
	//console.log('Inside submit workerid is ' + workerId);
	expressionInput.val(player1Input);
	imageDetailsInput.val(imageDetails);

	$.ajax({
		type: 'POST',
		url: '/turkP1Expression',
		dataType: 'json',
		data: {imageDetails: imageDetails, expression: player1Input, imageNumber: imageNumber, workerId: workerId},
		success: function(data) {
			console.log('Successfully sent to server. Now sending to Mechanical Turk');
			$('#turkForm').submit();
		},
		error: function(xhr, ajaxOptions, thrownError) {
	         alert('Sorry, an error occured while trying to contact the server for turkP1Expression.\n' +
	                xhr.responseText + ajaxOptions + thrownError);
	    }
	});
}

//Display time
function countdown() {
    var timeDisplay = $('#timeDisplay');
    var timeString = time.toString();
    if(time == 1) {
        timeString += " second";
    }
    else timeString += " seconds";
    timeDisplay.html(timeString);
    time++;
}

function mTurkUser() {
    //console.log("Trying to submit form. Assignment Id is " +  gup('assignmentId'));
    return gup('assignmentId') != 0;
}


// Gets parameters 
function gup(name) {
  var regexS = "[\\?&]" + name + "=([^&#]*)";
  var regex = new RegExp(regexS);
  var tempURL = window.location.href;
  var results = regex.exec(tempURL);
  //console.log("Gup results: " + results + ".")
  if(results == null )
    return "";
  else
    return results[1];
}

//Popup code
function loading() {
	$('div.loader').show();
}

function closeLoading() {
	$('div.loader').fadeOut('normal');
}

function loadPopup() {
	if(popupStatus == 0) { //show popup
		closeLoading(); //fadeout loading
		$('#toPopup').fadeIn(0500); //fade in popup div
		$('#backgroundPopup').css('opacity', '0.7');
		$('#backgroundPopup').fadeIn(001);
		popupStatus = 1;
	}
}

function disablePopup() {
	if(popupStatus == 1) {
		$('#toPopup').fadeOut('normal');
		$('#backgroundPopup').fadeOut('normal');
		popupStatus = 0;
	}
}
