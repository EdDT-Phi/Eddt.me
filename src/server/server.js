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
	 var radius = util.hpToRadius(conf.mouse.xp);
	 while (toAdd--) {
		  var position = conf.foodUniformDisposition ? util.uniformPosition(mice, radius) : util.randomPosition(radius);
		  mice.push({
				// Make IDs unique.
				id: ((new Date()).getTime() + '' + mice.length) >>> 0,
				x: position.x,
				y: position.y,
				radius: radius,
				hp: conf.mouse.hp,
				maxHP: conf.mouse.hp,
				attack: conf.mouse.attack,
				defense: conf.mouse.defense,
				direction: Math.random() * 2 * Math.PI
				// hue: Math.round(Math.random() * 360),
		  });
	 }
}

function addSpider(toAdd) {
	 while (toAdd--) {
		  var mass = 50;//util.randomInRange(conf.spider.defaultMass.from, conf.spider.defaultMass.to, true);
		  var radius = util.hpToRadius(mass);
		  // var position = conf.spiderUniformDisposition ? util.uniformPosition(spider, radius) : util.randomPosition(radius);
		  spiders.push({
				id: ((new Date()).getTime() + '' + spiders.length) >>> 0,
				x: Math.random() * conf.gameHeight, //position.x,
				y: Math.random() * conf.gameWidth, //position.y,
				radius: radius,
				hp: conf.spider.hp,
				maxHP: conf.spider.hp,
				attack: conf.spider.attack,
				defense: conf.spider.defense,
				direction: Math.random() * 2 * Math.PI,
				attackCounter: -1
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
	var miceDiff = conf.mouse.amount - mice.length;
	if (miceDiff > 0) {
		addMice(miceDiff);
	}

	var spiderToAdd = conf.spider.amount - spiders.length;
	if (spiderToAdd > 0)
		addSpider(spiderToAdd);
}

function addPlayers()
{
	var radius = util.hpToRadius(conf.playerHp[0]);
	for(var Us = users.length; Us < conf.AIUsers; Us++)
	{
		var position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);
		var name = util.randomName();
		users.push(
		{
			level: 0,
			name: name,
			type : 'fake',
			x : position.x,
			y : position.y,
			radius : radius,
			hp : conf.playerHp[0],
			maxHP : conf.playerHp[0],
			speed : conf.playerSpeed[0],
			attack: conf.playerAttack[0],
			defense: conf.playerDefense[0],
			attackCounter : -1
			// mass : conf.defaultPlayerMass,
		});
		io.emit('playerJoin', { name: name });
	}
}

io.on('connection', function (socket) {
	console.log('A user connected!', socket.handshake.query.type);

	var type = socket.handshake.query.type;
	var radius = util.hpToRadius(conf.playerHp[0]);
	var position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

	var currentPlayer = {
		xp: 0,
		level: 0,
		type: type,
		radius: radius,
		id: socket.id,
		x: position.x,
		y: position.y,
		lastHeartbeat: new Date().getTime(),
		attackCounter: -1,
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

			currentPlayer.dead = false;
			currentPlayer.hp = conf.playerHp[0];
			currentPlayer.maxHP = conf.playerHp[0];
			currentPlayer.attack = conf.playerAttack[0];
			currentPlayer.defense = conf.playerDefense[0];
			currentPlayer.speed = conf.playerSpeed[0];




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

function attackFunc(p1, p2)
{
	p1.attackCounter = conf.playerAttackCounter;
	p2.hp -= Math.floor((p1.attack * p1.attack) / p2.defense) * 4;
	p2.hp = Math.max(0, p2.hp);
	if(p2.hp === 0)
	{
		killFunc(p2);
		return "dead";
	}
}

function killFunc(creature)
{
	creature.dead = true;
	creature.deadCounter = conf.counters.dead;
}

function tickPlayer(currentPlayer) {

	if(currentPlayer.deadCounter >= 0)
	{
		if(--currentPlayer.deadCounter === 0)
			return "dead";
		return;
	}


	if(currentPlayer.lastHeartbeat < new Date().getTime() - conf.maxHeartbeatInterval) {
		sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + conf.maxHeartbeatInterval/1000.0 + ' seconds ago.');
		sockets[currentPlayer.id].disconnect();
	}

	movePlayer(currentPlayer);

	if(currentPlayer.attackCounter >= 0)
	{
		currentPlayer.attackCounter--;
	}

	var dist;
	for (var i = 0; i < users.length; i++) {
		dist = util.getDistance(users[i], currentPlayer);
		if(currentPlayer.id !== users[i].id  &&currentPlayer.attackCounter < 0 && !users[i].dead && dist < 0)
		{
			if(attackFunc(currentPlayer, users[i]) === "dead")
			{
				currentPlayer.xp += conf.xpForKill[users[i].level];
			}

		}
	}

	for (i = 0; i < spiders.length; i++) {
		dist = util.getDistance(spiders[i], currentPlayer);
		if(currentPlayer.attackCounter < 0 && !spiders[i].dead && dist < 0)
		{
			if(attackFunc(currentPlayer, spiders[i]) === "dead")
			{
				currentPlayer.xp += conf.spider.xp;
			}

		}
	}

	for (i = 0; i < mice.length; i++) {
		dist = util.getDistance(mice[i], currentPlayer);
		if(currentPlayer.attackCounter < 0 && !mice[i].dead && dist < 0)
		{
			if(attackFunc(currentPlayer, mice[i]) === "dead")
			{
				currentPlayer.xp += conf.mouse.xp;
			}
		}
	}



	if(currentPlayer.xp > conf.xpForLevel[currentPlayer.level])
	{
		currentPlayer.level++;
		currentPlayer.xp = 0;

		currentPlayer.hp += conf.playerHp[currentPlayer.level];
		currentPlayer.maxHP += conf.playerHp[currentPlayer.level];
		currentPlayer.speed += conf.playerSpeed[currentPlayer.level];
		currentPlayer.attack += conf.playerAttack[currentPlayer.level];
		currentPlayer.defense += conf.playerDefense[currentPlayer.level];

		currentPlayer.radius = util.hpToRadius(currentPlayer.maxHP);
	}


	// todo: player collisions
}


function tickMouse(mouse)
{
	if(mouse.deadCounter >= 0)
	{
		if(--mouse.deadCounter === 0)
			return "dead";
		return;
	}
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
	if(spider.deadCounter >= 0)
	{
		if(--spider.deadCounter === 0)
			return "dead";
		return;
	}

	var minDist = conf.spider.sight, minTarget, dist = 0;

	if(spider.attackCounter >= 0)
	{
		spider.attackCounter--;
	}


	if(!spider.target || util.getDistance(spider, spider.target) >= conf.spider.sight || spider.target.dead)
	{
		for(var i = 0; i < users.length; i++)
		{
			dist = util.getDistance(users[i], spider);
			if (users[i].dead !== true)
			{
				if(spider.attackCounter < 0 && dist < 0)
				{
					attackFunc(spider, users[i]);
				}
				if (spider.attack > users[i].defense && dist < minDist) {
					minDist = dist;
					minTarget = users[i];
				}
			}
		}

		if (minDist === conf.spider.sight)
		{
			for(i = 0; i < mice.length; i++)
			{
				dist = util.getDistance(spider, mice[i]);
				if(mice[i].dead !== true && dist < minDist)
				{
						minDist = dist;
						minTarget = mice[i];
				}
			}
		}

		spider.target = minTarget;
	}


	// spider.direction = Math.PI/2;
	if (spider.target)
	{
		if(spider.attackCounter < 0 && util.getDistance(spider, spider.target) < 0)
		{

			if(attackFunc(spider, spider.target) === "dead")
			{
				spider.target = null;
				return;
			}
		}

		var newDirection = 0;
		if(spider.target.y === spider.y)
		{
			if(spider.target.x < spider.x)
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
			newDirection = Math.atan((spider.x - spider.target.x)/(spider.target.y - spider.y));
		}

		if(spider.target.y-spider.y < 0)
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
		if (tickMouse(mice[i]) === "dead")
		{
			mice.splice(i,1);
			i--;
		}
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
		if(tickPlayer(users[i]) === "dead")
		{
			io.emit('playerDied', { name: users[i].name });
			if(users[i].type != 'fake')
			{
				sockets[users[i].id].emit('RIP');
			}
			users.splice(i, 1);
			i--;
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
						return {
							x: mouse.x,
							y: mouse.y,
							hp: mouse.hp,
							maxHP: mouse.maxHP,
							direction: mouse.direction,
						};
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
