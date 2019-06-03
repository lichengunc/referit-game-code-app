$(document).ready(function() {
	$('#playButton').click(function() {
		window.location.href = '/play';
	});

	$('#directPlayButton').click(function() {
		window.location.href = '/play';
	});

	$('#registerButton').click(function() {
		window.location.href = '/register';
	});

	$('.question').click(function() {
		$(this).children('.answer').toggle('fast');
	});
});