/* jslint node: true */

'use strict';

var cfg = require('../../../config.json');

exports.validNick = function(nickname) {
	var regex = /^\w*$/;
	return regex.exec(nickname) !== null;
};

// determine radius of circle
exports.hpToRadius = function (hp) {
	return Math.sqrt(hp) * 5 + 10;
};


// overwrite Math.log function
exports.log = (function () {
	var log = Math.log;
	return function (n, base) {
		return log(n) / (base ? log(base) : 1);
	};
})();

// get the Euclidean distance between the edges of two shapes
exports.getDistance = function (p1, p2) {
	return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
};

exports.randomInRange = function (from, to) {
	return Math.floor(Math.random() * (to - from)) + from;
};

// generate a random position within the field of play
exports.randomPosition = function (radius) {
	return {
		x: exports.randomInRange(radius, cfg.gameWidth - radius),
		y: exports.randomInRange(radius, cfg.gameHeight - radius)
	};
};

exports.uniformPosition = function(points, radius) {
	var bestCandidate, maxDistance = 0;
	var numberOfCandidates = 10;

	if (points.length === 0) {
		return exports.randomPosition(radius);
	}

	// Generate the cadidates
	for (var ci = 0; ci < numberOfCandidates; ci++) {
		var minDistance = Infinity;
		var candidate = exports.randomPosition(radius);
		candidate.radius = radius;

		for (var pi = 0; pi < points.length; pi++) {
			var distance = exports.getDistance(candidate, points[pi]);
			if (distance < minDistance) {
				minDistance = distance;
			}
		}

		if (minDistance > maxDistance) {
			bestCandidate = candidate;
			maxDistance = minDistance;
		} else {
			return exports.randomPosition(radius);
		}
	}

	return bestCandidate;
};

exports.findUserById = function(arr, id) {
	var len = arr.length;

	while (len--) {
		if (arr[len].id === id) {
			return len;
		}
	}

	return -1;
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


exports.randomName = function() {
	var names = ["3D Waffle", "57 Pixels","101","Accidental Genius","Alpha",
	"Airport Hobo","Bearded Angler","Beetle King","Bitmap","Blister","Bowie",
	"Bowler","Breadmaker","Broomspun","Buckshot","Bugger","Cabbie","Candy Butcher",
	"Capital F","Captain Peroxide","Celtic Charger","Cereal Killer","Chicago Blackout",
	"Chocolate Thunder","Chuckles","Commando","Cool Whip","Cosmo","Crash Override",
	"Crash Test","Crazy Eights","Criss Cross","Cross Thread","Cujo",
	"Dancing Madman","Dangle","Dark Horse","Day Hawk","Desert Haze","Digger",
	"Disco Thunder","Disco Potato","Dr. Cocktail","Dredd","Dropkick","Drop Stone",
	"Drugstore Cowboy","Easy Sweep","Electric Player","Esquire","Fast Draw",
	"Flakes","Flint","Freak","Gas Man","Glyph","Grave Digger","Guillotine",
	"Gunhawk","High Kingdom Warrior","Highlander Monk","Hightower","Hog Butcher",
	"Houston","Hyper","Jester","Jigsaw","Joker's Grin","Judge","Junkyard Dog",
	"K-9","Keystone","Kickstart","Kill Switch","Kingfisher","Kitchen","Knuckles",
	"Lady Killer","Liquid Science","Little Cobra","Little General","Lord Nikon",
	"Lord Pistachio","Mad Irishman","Mad Jack","Mad Rascal","Manimal","Marbles",
	"Married Man","Marshmallow","Mental","Mercury Reborn","Midas",
	"Midnight Rambler","Midnight Rider","Mindless Bobcat","Mr. 44","Mr. Fabulous",
	"Mr. Gadget","Mr. Lucky","Mr. Peppermint","Mr. Spy","Mr. Thanksgiving",
	"Mr. Wholesome","Mud Pie Man","Mule Skinner","Murmur","Nacho","Natural Mess",
	"Necromancer","Neophyte Believer","Nessie","New Cycle","Nickname Master",
	"Nightmare King","Night Train","Old Man Winter","Old Orange Eyes",
	"Old Regret","Onion King","Osprey","Overrun","Papa Smurf","Pepper Legs",
	"Pinball Wizard","Pluto","Pogue","Prometheus","Psycho Thinker","Pusher",
	"Riff Raff","Roadblock","Rooster","Sandbox","Scrapper","Screwtape",
	"Sexual Chocolate","Shadow Chaser","Sherwood Gladiator","Shooter",
	"Sidewalk Enforcer","Skull Crusher","Sky Bully","Slow Trot","Snake Eyes",
	"Snow Hound","Sofa King","Speedwell","Spider Fuji","Springheel Jack",
	"Squatch","Stacker of Wheat","Sugar Man","Suicide Jockey","Swampmasher",
	"Swerve","Tacklebox","Take Away","Tan Stallion","The China Wall","The Dude",
	"The Flying Mouse","The Happy Jock","The Howling Swede","Thrasher","Toe",
	"Toolmaker","Tough Nut","Trip","Troubadour","Turnip King","Twitch",
	"Vagabond Warrior","Voluntary","Vortex","Washer","Waylay Dave","Wheels",
	"Wooden Man","Woo Woo","Yellow Menace","Zero Charisma","Zesty Dragon","Zod"];
	var other = ["Tyler \"H-12\" Camp", "WHOM", "Br9don", "Joby Wan Kenobi", "Trung Tran", "Fire Bird"];

	var name = exports.randomInRange(0, names.length * 2);
	if(name < names.length)
		return names[name];
	else
		return other[name % other.length];
};