var imageIndex;
var locationArray = new Array;
var timerId;
var time = 0;
var imageDetailsP2 = '';
var expressionP2 = '';
var correctness = '';
var imageNumber = '';

var dotCount = 0; // Used to determine if there is a dot currently on the screen 
// Used for calculating location of player 2's click
var x = -1; 
var y = -1;
var w = -1;
var h = -1;
var xClick = 0;
var yClick = 0;

var workerId;
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
		workerId = gup('workerId');
		$('#workerId').val(workerId);
		var form = $('#turkForm');
		if(document.referrer && (document.referrer.indexOf('workersandbox') != -1)) {
			form.action = 'http://workersandbox.mturk.com/mturk/externalSubmit';	
		}	
	}

	timerId = setInterval(countdown, 1000);
	setupTurn2();

	$('#submitButton').click(function(event) {
		event.preventDefault();
		evaluate(xClick, yClick);
	});

  	$('#mainImage').click(function(event) {
		if(dotCount == 1) {
		    //Redraw dot each time player 2 clicks
		    resetDot();
		}

		//To account for padding and margins
		var jThis = $(this);
		var offsetFromParent = jThis.position();
		var topThickness = (jThis.outerHeight(true) - jThis.height())/2;
		var leftThickness = (jThis.outerWidth(true) - jThis.width())/2;

		x = Math.round(event.pageX - offsetFromParent.left - leftThickness);
		y = Math.round(event.pageY - offsetFromParent.top - topThickness);

		w = $('#mainImage').width();
		h = $('#mainImage').height();

		//Use ratio of click coordinates to account for different image sizes
		xClick = x/w;
		yClick = y/h;
		drawDot(xClick, yClick);
    });
});

function setupTurn2() {
	turn2Visibility();
	if(gup('assignmentId') == 'ASSIGNMENT_ID_NOT_AVAILABLE') {
		$('#mainImage').attr('src', 'img/loadScreen.jpg')
	}
	else 
		getTurn2Image();
}

function turn2Visibility() {
	var textBoxDiv = $('#container');
    var textBox = $('#textBox');
    var buttonDiv = $('#containerButton');
    var submitButton = $('#submitButton');
    var expression = $('#expression');
    var directions = $('#directions');
    var textBoxDiv2 = document.getElementById('container');
    var rightWrong = $('#rightWrong');

 	textBoxDiv.css('visibility', 'hidden');
    textBox.css('visibility', 'hidden');
    buttonDiv.css('visibility', 'visible');
    submitButton.css('visibility', 'visible');
    expression.html('');
    directions.html('Click on the object in the image described by the phrase below.');
    rightWrong.css('visibility', 'hidden');
}

function getTurn2Image() {
	var img = $('#mainImage');
	var expression = $('#expression');
	img.attr('alt', 'Next image.');

	$.ajax({
		type: 'GET',
		url: '/turkP2Image',
		dataType: 'json',
		success: function(data) {
			var labelerId = data.workerId;
			//console.log('Workerid is ' + workerId + ' and labelerid is ' + labelerId);
			if(labelerId == workerId) {
				location.reload();
			}
			//console.log('TurkP2Image is ' + data.imageDetails + ' ' + data.expression);
			expressionP2 = data.expression;
			imageDetailsP2 = data.imageDetails + '_,_' + expressionP2 + '_,_';
			expression.html(expressionP2);

			for(var j = 0; j < 4; j++) {
	            locationArray[j] = imageDetailsP2.split(",")[j+1];
	            //console.log("Location array for P2 " + imageDetailsP2 + " is " + locationArray[j]);
	        }
	        locationArray[3] = locationArray[3].split('_')[0];
	        imageNumber = imageDetailsP2.split(',')[0];
	        var imageNumberP2 = 'ImagesP2/' + imageNumber.split('_')[0] + '.jpg';
	        //console.log('imageNumberP2 is ' + imageNumberP2);
	        img.attr('src', imageNumberP2);
		},
		error: function(xhr, ajaxOptions, thrownError) {
	         alert('Sorry, an error occured while trying to contact the server for turkP2Image.\n' +
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

//Draw a green dot on the image showing where player 2 clicked
function drawDot(xIn, yIn) {
    w = $('#mainImage').width();
    h = $('#mainImage').height();

    var boxPos = getElementPosition(document.getElementById('mainImage'));
    var color = '#00FF00';
    var size = '11px';
    $('#dotContainer').append(
        $('<div></div>')
            .css('position', 'absolute')
            .css('top', yIn*h + boxPos.y - 3 + 'px')
            .css('left', xIn*w + boxPos.x - 3 + 'px')
            .css('width', size)
            .css('height', size)
            .css('background-color', color)
            .css('z-index', 50)
    );
    dotCount = 1;
}

//Removes the dot from the image
function resetDot() {
    $('#dotContainer').html('');
    dotCount = 0;
    x = -1;
    y = -1;
    w = -1;
    h = -1;
}

//Helper function for drawDot(). Gets the absolute position of the image
function getElementPosition(theElement) {
    var posX = 0;
    var posY = 0;

    while(theElement != null) {
        posX += theElement.offsetLeft;
        posY += theElement.offsetTop;
        theElement = theElement.offsetParent;
    }
    return {x: posX, y:posY};
}

function evaluate(xClick, yClick) {
   if(xClick > locationArray[0] && xClick < locationArray[1] && yClick > locationArray[2] && yClick < locationArray[3]) {
    	correctness = 'Correct!';
    }
    else {
    	correctness = 'Incorrect!';
    }
    var output = $('#rightWrong');
    output.html(correctness);
    output.css('z-index', 999);
    output.animate({opacity: 1}, {duration: 500});
    output.animate({opacity: 0}, {duration: 2500});
	submitLocation(xClick, yClick);
}

function submitLocation(xClick, yClick) {
	var coordinates = xClick.toString() + ';' + yClick.toString();
	var locationString = '';
	for(var i = 0; i < locationArray.length; i++) {
		locationString += locationArray[i] + ';'
	}
	var expressionOutput = imageDetailsP2 + '_,_' + correctness + '_,_' + 
	coordinates + '_,_' + locationString;
	$('#fullOutput').val(expressionOutput);
	$('#expressionInput').val(expressionP2);
	$('#correctness').val(correctness);
	$('#imageNumber').val(imageNumber);
	//console.log('FullOutput is ' + expressionOutput + ' Expression: ' + expressionP2 + ' Correctness: ' + correctness + ' ImageNumber: ' + imageNumber);
	$.ajax({
		type: 'POST',
		url: '/turkLocation',
		dataType: 'json',
		data: {expression: expressionP2, fullOutput: expressionOutput, correctness: correctness, imageNumber: imageNumber},
		success: function(data) {
			//console.log('Success data: ' + data.message + '. Now sending to mTurk.');
			$('#turkForm').submit();
		},
		error: function(xhr, ajaxOptions, thrownError) {
	         alert('Sorry, an error occured while trying to contact the server for turkLocation.\n' +
	                xhr.responseText + ajaxOptions + thrownError);
	    }
	});
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


