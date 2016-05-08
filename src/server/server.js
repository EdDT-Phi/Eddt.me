/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');

// Import game settings.
var conf = require('../../config.json');

// Import utilities.
var util = require('./lib/util');

// Import quadtree.
var quadtree= require('../../quadtree');

var args = {x : 0, y : 0, h : conf.gameHeight, w : conf.gameWidth, maxChildren : 1, maxDepth : 5};
console.log(args);

var tree = quadtree.QUAD.init(args);

var users = [];

// var massFood = [];
var mice = [];
var spiders = [];
var sockets = {};


var leaderboard = [];
var leaderboardChanged = false;

var V = SAT.Vector;
var C = SAT.Circle;

var initMassLog = util.log(conf.defaultPlayerMass, conf.slowBase);

app.use(express.static(__dirname + '/../client'));

function addMice(toAdd) {
	 var radius = util.massToRadius(conf.mouse.xp);
	 while (toAdd--) {
		  var position = conf.foodUniformDisposition ? util.uniformPosition(mice, radius) : util.randomPosition(radius);
		  mice.push({
				// Make IDs unique.
				id: ((new Date()).getTime() + '' + mice.length) >>> 0,
				x: position.x,
				y: position.y,
				radius: radius,
				mass: Math.random() + 2,
				// hue: Math.round(Math.random() * 360),
				direction: Math.random() * 2 * Math.PI
		  });
	 }
}

function addSpider(toAdd) {
	 while (toAdd--) {
		  var mass = 50;//util.randomInRange(conf.spider.defaultMass.from, conf.spider.defaultMass.to, true);
		  var radius = util.massToRadius(mass);
		  // var position = conf.spiderUniformDisposition ? util.uniformPosition(spider, radius) : util.randomPosition(radius);
		  spiders.push({
				id: ((new Date()).getTime() + '' + spiders.length) >>> 0,
				x: Math.random() * conf.gameHeight, //position.x,
				y: Math.random() * conf.gameWidth, //position.y,
				mass: mass,
				radius: radius,
				direction: Math.random() * 2 * Math.PI
		  });
	 }
}

function removeFood(toRem)
{
	 while (toRem--)
	 {
		  mice.pop();
	 }
}

function movePlayer(player)
{
	var dist;

	if(player.type == 'fake')
	{
		var minDist = 10000;
		for(var i = 0; i < mice.length; i++)
		{
		   dist = util.getDistance(mice[i], player);
		   if(dist < minDist)
		   {
		   	player.target = {
		   		x: mice[i].x - player.x,
		   		y: mice[i].y - player.y
		   	};
		   	minDist = dist;
		   }
		}
	}

	if(!player.target) return;

	dist = Math.sqrt(Math.pow(player.target.y, 2) + Math.pow(player.target.x, 2));
	var deg = Math.atan2(player.target.y, player.target.x);

	// var slowDown = 1;
	// if(player.speed <= 6.25)
	// {
	// 	slowDown = util.log(player.mass, conf.slowBase) - initMassLog + 1;
	// }

	var deltaY = player.speed * Math.sin(deg); // / slowDown;
	var deltaX = player.speed * Math.cos(deg); // / slowDown;

	// if(player.speed > 6.25)
	// {
	// 	player.speed -= 0.5;
	// }

	if (dist < (50 + player.radius))
	{
		deltaY *= dist / (50 + player.radius);
		deltaX *= dist / (50 + player.radius);
	}
	if (!isNaN(deltaY))
	{
		player.y += deltaY;
	}
	if (!isNaN(deltaX))
	{
		player.x += deltaX;
	}

	var borderCalc = player.radius / 3;
	if (player.x > conf.gameWidth - borderCalc)
	{
		 player.x = conf.gameWidth - borderCalc;
	}
	if (player.y > conf.gameHeight - borderCalc)
	{
		 player.y = conf.gameHeight - borderCalc;
	}
	if (player.x < borderCalc)
	{
		 player.x = borderCalc;
	}
	if (player.y < borderCalc)
	{
		 player.y = borderCalc;
	}
}

function balanceMass() {
	// var totalMass = mice.length * conf.foodMass +
	//   users
	// 		.map(function(u) {return u.mass; })
	// 		.reduce(function(pu,cu) { return pu+cu;}, 0);

	// var massDiff = conf.gameMass - totalMass;
	// var maxMiceDiff = conf.maxMice - mice.length;
	// var MiceDiff = parseInt(massDiff / conf.foodMass) - maxMiceDiff;
	// var miceToAdd = Math.min(MiceDiff, maxMiceDiff);
	// var miceToRemove = -Math.max(MiceDiff, maxMiceDiff);

	var miceDiff = conf.mouse.amount - mice.length;
	if (miceDiff > 0) {
		//console.log('[DEBUG] Adding ' + miceToAdd + ' food to level!');
		addMice(miceDiff);
		//console.log('[DEBUG] Mass rebalanced!');
	}
	// else
	// {
	// 	//console.log('[DEBUG] Removing ' + miceToRemove + ' food from level!');
	// 	removeFood(miceDiff);
	// 	//console.log('[DEBUG] Mass rebalanced!');
	// }

	var spiderToAdd = conf.spider.amount - spiders.length;
	if (spiderToAdd > 0)
		addSpider(spiderToAdd);
}

function addPlayers()
{
	var radius = util.massToRadius(conf.hpForLevel[0]);
	for(var Us = users.length; Us < conf.AIUsers; Us++)
	{
	var position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);
		users.push(
		{
			level: 0,
			type : 'fake',
			x : position.x,
			y : position.y,
			radius : radius,
			hp : conf.hpForLevel[0],
			name : "An unnamed cell",
			maxHP : conf.hpForLevel[0],
			speed : conf.speedForLevel[0],
			// mass : conf.defaultPlayerMass,
		});
		io.emit('playerJoin', { name: "An unnamed cell" });
	}
}

io.on('connection', function (socket) {
	console.log('A user connected!', socket.handshake.query.type);

	var type = socket.handshake.query.type;
	var radius = util.massToRadius(conf.hpForLevel[0]);
	var position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

	var mass = conf.hpForLevel[0];
	var currentPlayer = {
		id: socket.id,
		x: position.x,
		y: position.y,
		hp: mass,
		maxHP: mass,
		radius: radius,
		type: type,
		level: 0,
		xp: 0,
		speed: conf.speedForLevel[0],
		lastHeartbeat: new Date().getTime(),
		target: {
			x: 0,
			y: 0
		}
	};

	socket.on('gotit', function (player) {
	   console.log('[INFO] Player ' + player.name + ' connecting!');
		if (util.findIndex(users, player.id) > -1) {
			console.log('[INFO] Player ID is already connected, kicking.');
			socket.disconnect();
		} else if (!util.validNick(player.name)) {
			socket.emit('kick', 'Invalid username.');
			socket.disconnect();
		} else {
			console.log('[INFO] Player ' + player.name + ' connected!');
			sockets[player.id] = socket;
			currentPlayer = player;
			users.push(currentPlayer);
			io.emit('playerJoin', { name: player.name });
			socket.emit('gameSetup', {
				 gameWidth: conf.gameWidth,
				 gameHeight: conf.gameHeight
			});
			console.log('Total players: ' + users.length);
		}
	});

	socket.on('ping', function () {
		socket.emit('pong');
	});

	socket.on('windowResized', function (data) {
		currentPlayer.screenWidth = data.screenWidth;
		currentPlayer.screenHeight = data.screenHeight;
	});

	 socket.on('respawn', function () {
		  if (util.findIndex(users, currentPlayer.id) > -1)
				users.splice(util.findIndex(users, currentPlayer.id), 1);
		  socket.emit('welcome', currentPlayer, {xpLevels: conf.xpForLevel});
		  console.log('[INFO] User ' + currentPlayer.name + ' respawned!');
	 });

	 socket.on('disconnect', function () {
		  if (util.findIndex(users, currentPlayer.id) > -1)
				users.splice(util.findIndex(users, currentPlayer.id), 1);
		  console.log('[INFO] User ' + currentPlayer.name + ' disconnected!');

		  socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
	 });

	 socket.on('playerChat', function(data) {
		  var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
		  var _message = data.message.replace(/(<([^>]+)>)/ig, '');
		  if (conf.logChat === 1) {
				console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
		  }
		  socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
	 });

	 socket.on('pass', function(data) {
		  if (data[0] === conf.adminPass) {
				console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin!');
				socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
				socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as admin!');
				currentPlayer.admin = true;
		  } else {
				console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with incorrect password.');
				socket.emit('serverMSG', 'Password incorrect, attempt logged.');
				// TODO: Actually log incorrect passwords.
		  }
	 });

	 socket.on('kick', function(data) {
		  if (currentPlayer.admin) {
				var reason = '';
				var worked = false;
				for (var e = 0; e < users.length; e++) {
					 if (users[e].name === data[0] && !users[e].admin && !worked) {
						  if (data.length > 1) {
								for (var f = 1; f < data.length; f++) {
									 if (f === data.length) {
										  reason = reason + data[f];
									 }
									 else {
										  reason = reason + data[f] + ' ';
									 }
								}
						  }
						  if (reason !== '') {
							  console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
						  }
						  else {
							  console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name);
						  }
						  socket.emit('serverMSG', 'User ' + users[e].name + ' was kicked by ' + currentPlayer.name);
						  sockets[users[e].id].emit('kick', reason);
						  sockets[users[e].id].disconnect();
						  users.splice(e, 1);
						  worked = true;
					 }
				}
				if (!worked) {
					 socket.emit('serverMSG', 'Could not locate user or user is an admin.');
				}
		  } else {
				console.log('[ADMIN] ' + currentPlayer.name + ' is trying to use -kick but isn\'t an admin.');
				socket.emit('serverMSG', 'You are not permitted to use this command.');
		  }
	 });

	 // Heartbeat function, update everytime.
	 socket.on('0', function(target) {
		  currentPlayer.lastHeartbeat = new Date().getTime();
		  // console.log(target);
		  if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
				currentPlayer.target = target;
		  }
	 });
});

function tickPlayer(currentPlayer) {
	 if(currentPlayer.lastHeartbeat < new Date().getTime() - conf.maxHeartbeatInterval) {
		  sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + conf.maxHeartbeatInterval/1000.0 + ' seconds ago.');
		  sockets[currentPlayer.id].disconnect();
	 }

	 movePlayer(currentPlayer);

	 function funcFood(f) {
		  return SAT.pointInCircle(new V(f.x, f.y), playerCircle);
	 }

	function deleteFood(f) {
		if(mice[f])
			mice[f].dead = true;
		mice.splice(f, 1);
	}

	 function eatMass(m) {
		  if(SAT.pointInCircle(new V(m.x, m.y), playerCircle)){
				if(m.id == currentPlayer.id && m.speed > 0)// && z == m.num)
					 return false;
				if(currentPlayer.mass > m.masa * 1.1)
					 return true;
		  }
		  return false;
	 }

	 function check(user) {
		  // for(var i=0; i<user.cells.length; i++) {
				if(user.mass > 10 && user.id !== currentPlayer.id) {
					 var response = new SAT.Response();
					 var collided = SAT.testCircleCircle(playerCircle,
						  new C(new V(user.x, user.y), user.radius),
						  response);
					 if (collided) {
						  response.aUser = currentPlayer;
						  response.bUser = user;
						  playerCollisions.push(response);
					 }
				}
		  // }
	 }

	 function collisionCheck(collision) {
		 if (collision.aUser.mass > collision.bUser.mass * 1.1  && collision.aUser.radius > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2))*1.75) {
				console.log('[DEBUG] Killing user: ' + collision.bUser.id);
				console.log('[DEBUG] Collision info:');
				console.log(collision);

				var numUser = util.findIndex(users, collision.bUser.id);
				if (numUser > -1) {
					 // if(users[numUser].cells.length > 1) {
					 //     users[numUser].mass -= collision.bUser.mass;
					 //     users[numUser].cells.splice(collision.bUser.num, 1);
					 // } else {
						  users.splice(numUser, 1);
						  io.emit('playerDied', { name: collision.bUser.name });
						  if(collision.bUser.type != 'fake')
						  {
							  sockets[collision.bUser.id].emit('RIP');
						  }
					 // }
				}
				currentPlayer.mass += collision.bUser.mass;
				collision.aUser.mass += collision.bUser.mass;
		}
	 }

		var playerCircle = new C(
			 new V(currentPlayer.x, currentPlayer.y),
			 currentPlayer.radius
		);

		var foodEaten = mice.map(funcFood)
			 .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

		foodEaten.forEach(deleteFood);

		currentPlayer.xp += foodEaten.length;
		currentPlayer.radius = util.massToRadius(currentPlayer.hp);
		playerCircle.r = currentPlayer.radius;

		if(currentPlayer.xp > conf.xpForLevel[currentPlayer.level])
		{
			currentPlayer.level++;
			currentPlayer.xp = 0;

			currentPlayer.hp += conf.hpForLevel[currentPlayer.level];
			currentPlayer.maxHP += conf.hpForLevel[currentPlayer.level];
			currentPlayer.speed += conf.speedForLevel[currentPlayer.level];
		}


		// todo: get rid of this tree nonesence
		tree.clear();
		tree.insert(users);
		var playerCollisions = [];

		var otherUsers =  tree.retrieve(currentPlayer, check);

		playerCollisions.forEach(collisionCheck);
}


function tickMouse(mouse)
{
	var dx = -conf.mouse.speed * Math.sin(mouse.direction);
	var dy = conf.mouse.speed * Math.cos(mouse.direction);
	if (mouse.x + dx > conf.gameWidth || mouse.y + dy > conf.gameHeight || mouse.x + dx < 0 || mouse.y + dy < 0)
	{
		mouse.direction += 0.5;
	}
	else
	{
		mouse.x += dx;
		mouse.y += dy;
	}
}

function tickSpider(spider)
{
	var minDist = 10000, minTarget, dist = 0;
	for(var i = 0; i < users.length; i++)
	{
		dist = util.getDistance(users[i], spider);
		if(dist < 0)
		{
			if(spider.mass < users[i].mass)
			{
				users[0].mass += spiders[i].mass;
				return "dead";
			}
			else
			{
				users[i].dead = true;
			}
		} else if (spider.mass > users[i].mass && dist < minDist) {
			minDist = dist;
			minTarget = users[i];
		}
	}

	if (minDist > 300)
	{
		for(i = 0; i < mice.length; i++)
		{
			dist = util.getDistance(spider, mice[i]);
			if(dist < minDist)
			{
				if(dist < 0)
				{
					mice.splice(i, 1);
					i--;
				}
				else
				{
					minDist = dist;
					minTarget = mice[i];
				}
			}
		}
	}



	// spider.direction = Math.PI/2;
	if (minTarget)
	{

		var newDirection = 0;
		if(minTarget.y === spider.y)
		{
			if(minTarget.x < spider.x)
			{
				newDirection = Math.PI * 0.5;
			}
			else
			{
				newDirection = Math.PI * 1.5;
			}
		}
		else
		{
			newDirection = Math.atan((spider.x - minTarget.x)/(minTarget.y - spider.y));
		}
		if(minTarget.y-spider.y < 0)
		{
			newDirection += Math.PI;
		}


		spider.direction = newDirection;

		var dx = -conf.spider.speed * Math.sin(spider.direction);
		var dy = conf.spider.speed * Math.cos(spider.direction);
		spider.x += dx;
		spider.y += dy;
	}
}

function moveloop() {
	for (var i = 0; i < mice.length; i++)
	{
	  tickMouse(mice[i]);
	}
	for (i = 0; i < spiders.length; i++)
	{
		if(tickSpider(spiders[i]) === "dead")
		{
			spiders.splice(i, 1);
			i--;
		}
	}

	for (i = 0; i < users.length; i++)
	{
		if(users[i].dead)
		{
			io.emit('playerDied', { name: users[i].name });
			if(users[i].type != 'fake')
			{
				sockets[users[i].id].emit('RIP');
			}
			users.splice(i, 1);
			i--;
		}
		else
		{
			tickPlayer(users[i]);
		}
	}
}

function gameloop() {
	 if (users.length > 0) {
		  users.sort( function(a, b) { return b.mass - a.mass; });

		  var topUsers = [];

		  for (var i = 0; i < Math.min(10, users.length); i++) {
				if(users[i].type == 'player' || users[i].type == 'fake') {
					 topUsers.push({
						  id: users[i].id,
						  name: users[i].name
					 });
				}
		  }
		  if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
				leaderboard = topUsers;
				leaderboardChanged = true;
		  }
		  else {
				for (i = 0; i < leaderboard.length; i++) {
					 if (leaderboard[i].id !== topUsers[i].id) {
						  leaderboard = topUsers;
						  leaderboardChanged = true;
						  break;
					 }
				}
		  }
	 }
	 balanceMass();
	 addPlayers();
}

function sendUpdates() {
	users.forEach( function(u) {
		if(u.type != 'fake')
		{
			// center the view if x/y is undefined, this will happen for spectators
			u.x = u.x || conf.gameWidth / 2;
			u.y = u.y || conf.gameHeight / 2;



			/*
				uses filter to get rid of undefined values
			*/

			var visibleMice  = mice
				.map(function(mouse) {
					if ( mouse.x > u.x - u.screenWidth/2 - 20 &&
						mouse.x < u.x + u.screenWidth/2 + 20 &&
						mouse.y > u.y - u.screenHeight/2 - 20 &&
						mouse.y < u.y + u.screenHeight/2 + 20) {
						return mouse;
					}
				})
				.filter(function(f) { return f; });

			var visibleSpiders  = spiders
				.map(function(spider) {
					if ( spider.x > u.x - u.screenWidth/2 - spider.radius &&
						spider.x < u.x + u.screenWidth/2 + spider.radius &&
						spider.y > u.y - u.screenHeight/2 - spider.radius &&
						spider.y < u.y + u.screenHeight/2  + spider.radius) {
						return spider;
					}
				})
				.filter(function(f) { return f; });

			  // var visibleMass = massFood
			  //     .map(function(f) {
			  //         if ( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
			  //             f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
			  //             f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
			  //             f.y-f.radius < u.y + u.screenHeight/2 + 20) {
			  //             return f;
			  //         }
			  //     })
			  //     .filter(function(f) { return f; });

			var visibleCells  = users
			.map(function(user) {
				if ( user.x+user.radius > u.x - u.screenWidth/2 - 20 &&
					user.x-user.radius < u.x + u.screenWidth/2 + 20 &&
					user.y+user.radius > u.y - u.screenHeight/2 - 20 &&
					user.y-user.radius < u.y + u.screenHeight/2 + 20) {
						return user;
					}
				})
			.filter(function(f) {return f;});


			sockets[u.id].emit('serverTellPlayerMove', visibleCells, u, visibleMice, visibleSpiders);
			if (leaderboardChanged) {
				sockets[u.id].emit('leaderboard', {
					players: users.length,
					leaderboard: leaderboard
				});
			}
		}
	});
	leaderboardChanged = false;
}

setInterval(moveloop, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / conf.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || conf.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
	 http.listen( serverport, ipaddress, function() {
		  console.log('[DEBUG] Listening on *:' + serverport);
	 });
} else {
	 http.listen( serverport, function() {
		  console.log('[DEBUG] Listening on *:' + conf.port);
	 });
}
