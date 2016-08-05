/* jslint node: true */

'use strict';

var conf = require('../../config.json');

exports.validNick = function(nickname) {
	if(nickname)
		return true;
	var regex = /^\w*$/;
	return regex.exec(nickname) !== null;
};

// determine radius of circle
exports.levelToRadius = function (level) {
	return level * 2 + 30;
};


// overwrite Math.log function
exports.log = (function () {
	var log = Math.log;
	return function (n, base) {
		return log(n) / (base ? log(base) : 1);
	};
})();

// get the Euclidean distance between the edges of two shapes
exports.getDistance = function (p1, p2, rad) {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - (rad === false ? 0 : p1.radius + p2.radius);
};

exports.randomInRange = function (from, to) {
	return Math.floor(Math.random() * (to - from)) + from;
};

// generate a random position within the field of play
exports.randomPosition = function (radius) {
	return {
		x: exports.randomInRange(radius, conf.gameWidth - radius),
		y: exports.randomInRange(radius, conf.gameHeight - radius)
	};
};

exports.newPlayerPos = function(radius)
{
	var r = exports.randomInRange(radius-1000, radius);
	var deg = Math.random() * Math.PI * 2;
	return {x: r * Math.cos(deg) + radius, y: r * Math.sin(deg) + radius};
};

// exports.uniformPosition = function(points, radius) {
// 	var bestCandidate, maxDistance = 0;
// 	var numberOfCandidates = 10;

// 	if (points.length === 0) {
// 		return exports.randomPosition(radius);
// 	}

// 	// Generate the cadidates
// 	for (var ci = 0; ci < numberOfCandidates; ci++) {
// 		var minDistance = Infinity;
// 		var candidate = exports.randomPosition(radius);
// 		candidate.radius = radius;

// 		for (var pi = 0; pi < points.length; pi++) {
// 			var distance = exports.getDistance(candidate, points[pi]);
// 			if (distance < minDistance) {
// 				minDistance = distance;
// 			}
// 		}

// 		if (minDistance > maxDistance) {
// 			bestCandidate = candidate;
// 			maxDistance = minDistance;
// 		} else {
// 			return exports.randomPosition(radius);
// 		}
// 	}

// 	return bestCandidate;
// };

exports.findUserById = function(arr, id) {
	var len = arr.length;

	// console.log('looking for: ', id);
	while (len--) {
		if (arr[len].id === id) {
			return len;
		}
	}

	// console.log('not found: ', id);
	return undefined;
};

exports.randomColor = function() {
	var color = '#' + ('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6);
	var c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
	var r = (parseInt(c[1], 16) - 32) > 0 ? (parseInt(c[1], 16) - 32) : 0;
	var g = (parseInt(c[2], 16) - 32) > 0 ? (parseInt(c[2], 16) - 32) : 0;
	var b = (parseInt(c[3], 16) - 32) > 0 ? (parseInt(c[3], 16) - 32) : 0;

	return {
		fill: color,
		border: '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
	};
};

exports.getDirection = function (from, target) {
	if(target.y === from.y)
	{
		if(target.x < from.x)
		{
			return Math.PI * 0.5;
		}
		else
		{
			return Math.PI * 1.5;
		}
	}
	else
	{
		var newDirection = Math.atan((from.x - target.x)/(target.y - from.y));
		if(target.y < from.y)
		{
			return newDirection + Math.PI;
		}
		return newDirection;
	}
};


exports.randomName = function()
{
	return conf.names[exports.randomInRange(0, conf.names.length)];
};

exports.zombieFunc = function(num)
{
	return num - Math.floor(Math.sqrt(exports.randomInRange(0, num * num))) - 1;
};