/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// Import game settings.
var conf = require('../../config.json');

// Import utilities.
var util = require('./lib/util');

var args = {x : 0, y : 0, h : conf.gameHeight, w : conf.gameWidth, maxChildren : 1, maxDepth : 5};
console.log(args);


var users = [];

var mice = [];
var spiders = [];
var zombies = [];
var dragon = {
	type: 'dragon',
	x: conf.gameWidth/2, //position.x,
	y: conf.gameHeight/2, //position.y,
	radius: 50,
	state: 'idle',
	hp: conf.dragon.hp,
	maxHP: conf.dragon.hp,
	attack: conf.dragon.attack,
	defense: conf.dragon.defense,
	direction: Math.random() * 2 * Math.PI,
	attackCounter: -1};

var sockets = {};

var center = {
	x: conf.gameWidth/2,
	y: conf.gameHeight/2,
	radius: 5
};


var leaderboard = [];
var leaderboardChanged = false;

var initMassLog = util.log(conf.defaultPlayerMass, conf.slowBase);

app.use(express.static(__dirname + '/../client'));

function addMice() {
	 var radius = 30; // util.hpToRadius(conf.mouse.hp);
	 while (mice.length < conf.mouse.amount) {
		  var position = conf.foodUniformDisposition ? util.uniformPosition(mice, radius) : util.randomPosition(radius);
		  mice.push({
				// Make IDs unique.
				id: ((new Date()).getTime() + '' + mice.length) >>> 0,
				type: 'mouse',
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

function addSpiders() {
	var radius = 50; //util.hpToRadius(mass);
	while (spiders.length < conf.spider.amount) {
		spiders.push({
			id: ((new Date()).getTime() + '' + spiders.length) >>> 0,
			type: 'spider',
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

function addZombies() {
	var radius = 50; //util.hpToRadius(mass);
	while (zombies.length < conf.zombie.amount) {
		zombies.push({
			id: ((new Date()).getTime() + '' + zombies.length) >>> 0,
			type: 'zombie',
			x: Math.random() * conf.gameHeight, //position.x,
			y: Math.random() * conf.gameWidth, //position.y,
			radius: radius,
			hp: conf.zombie.hp,
			maxHP: conf.zombie.hp,
			attack: conf.zombie.attack,
			defense: conf.zombie.defense,
			direction: Math.random() * 2 * Math.PI,
			attackCounter: -1
		});
	}
}

function addPlayers()
{
	var radius = util.hpToRadius(conf.playerHp[0]);
	while(users.length < conf.AIUsers)
	{
		var position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);
		var name = util.randomName();
		users.push(
		{
			id: ((new Date()).getTime() + '' + users.length) >>> 0,
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
			attackCounter : -1,
			playerKills: 0
			// mass : conf.defaultPlayerMass,
		});
		io.emit('playerJoin', { name: name });
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

function addCreatures() {

	addMice();
	addSpiders();
	addZombies();
	// addDragons();
	addPlayers();

}



io.on('connection', function (socket) {
	console.log('A user connected!', socket.handshake.query.type);

	var type = socket.handshake.query.type;

	var currentPlayer = {
		xp: 0,
		level: 0,
		type: type,
		id: socket.id,
		lastHeartbeat: new Date().getTime(),
		attackCounter: -1,
		playerKills: 0,
		target: {
			x: 0,
			y: 0
		}
	};

	socket.on('gotit', function (player) {
	   console.log('[INFO] Player ' + player.name + ' connecting!');
		if (util.findUserById(users, player.id) > -1) {
			console.log('[INFO] Player ID is already connected, kicking.');
			socket.disconnect();
		} else if (!util.validNick(player.name)) {
			socket.emit('kick', 'Invalid username.');
			socket.disconnect();
		} else {
			console.log('[INFO] Player ' + player.name + ' connected!');
			sockets[player.id] = socket;

			currentPlayer = player;

			var position = util.newPlayerPos(conf.gameWidth/2);
			var radius = util.hpToRadius(conf.playerHp[0]);
			currentPlayer.dead = false;
			currentPlayer.xp = 0;
			currentPlayer.level = 0;
			currentPlayer.hp = conf.playerHp[0];
			currentPlayer.maxHP = conf.playerHp[0];
			currentPlayer.attack = conf.playerAttack[0];
			currentPlayer.defense = conf.playerDefense[0];
			currentPlayer.speed = conf.playerSpeed[0];
			currentPlayer.x =  position.x;
			currentPlayer.y =  position.y;
			currentPlayer.radius = radius;

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
		  if (util.findUserById(users, currentPlayer.id) > -1)
				users.splice(util.findUserById(users, currentPlayer.id), 1);
		  socket.emit('welcome', currentPlayer, {xpLevels: conf.xpForLevel});
		  console.log('[INFO] User ' + currentPlayer.name + ' respawned!');
	 });

	 socket.on('disconnect', function () {
		  if (util.findUserById(users, currentPlayer.id) > -1)
				users.splice(util.findUserById(users, currentPlayer.id), 1);
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

	socket.on('attack', function()
	{
		currentPlayer.attacking = true;
	});

	socket.on('attack', function()
	{
		currentPlayer.attacking = false;
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


	if(p2.type === 'zombie' || p2.type === 'dragon')
	{
		p2.target = p1;
	}

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


	if(currentPlayer.type == 'fake' || currentPlayer.attacking === true)
	{
		var dist;
		for (var i = 0; i < users.length; i++) {
			dist = util.getDistance(users[i], currentPlayer);
			if(currentPlayer.id !== users[i].id  && currentPlayer.attackCounter < 0 && !users[i].dead && dist < 0)
			{
				if(attackFunc(currentPlayer, users[i]) === "dead")
				{
					currentPlayer.playerKills++;
					currentPlayer.xp += conf.xpForKill[users[i].level];
				}

			}
		}

		if(currentPlayer.attackCounter < 0 && !dragon.dead && util.getDistance(dragon, currentPlayer) < 0 && attackFunc(currentPlayer, dragon) === "dead")
		{
			currentPlayer.xp += conf.dragon.xp;
		}

		for (i = 0; i < zombies.length; i++) {
			dist = util.getDistance(zombies[i], currentPlayer);
			if(currentPlayer.attackCounter < 0 && !zombies[i].dead && dist < 0)
			{
				if(attackFunc(currentPlayer, zombies[i]) === "dead")
				{
					currentPlayer.xp += conf.zombie.xp;
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
					currentPlayer.hp = Math.min(currentPlayer.maxHP, currentPlayer.hp + 5);
				}
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
		mouse.direction += 1;
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
			minDist = 10000;
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
		spider.x -= conf.spider.speed * Math.sin(spider.direction);
		spider.y += conf.spider.speed * Math.cos(spider.direction);
	}
}

function tickZombie(zombie)
{
	if(zombie.deadCounter >= 0)
	{
		if(--zombie.deadCounter === 0)
			return "dead";
		return;
	}

	if(zombie.attackCounter >= 0)
	{
		zombie.attackCounter--;
	}


	if(!dragon.dead && util.getDistance(zombie, dragon) < conf.zombie.sight)
	{
		zombie.target = null;
		var dy = dragon.y - zombie.y;
		if(dy === 0) dy = 0.1;
		zombie.direction = Math.atan((zombie.x - dragon.x)/(dy)) + Math.PI;
		// console.log(zombie.direction);

	}
	else
	{
		if(!zombie.target  || zombie.target.dead)
		{
			if(leaderboard.length > 0)
			{
				var id = leaderboard[util.randomInRange(0, leaderboard.length)].id;
				zombie.target = users[util.findUserById(users, id)];
			}
		}


		// zombie.direction = Math.PI/2;
		if (zombie.target)
		{
			if(zombie.attackCounter < 0 && util.getDistance(zombie, zombie.target) < 0)
			{
				if(attackFunc(zombie, zombie.target) === "dead")
				{
					zombie.target = null;
					return;
				}
			}

			var newDirection = 0;
			if(zombie.target.y === zombie.y)
			{
				if(zombie.target.x < zombie.x)
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
				newDirection = Math.atan((zombie.x - zombie.target.x)/(zombie.target.y - zombie.y));
			}

			if(zombie.target.y-zombie.y < 0)
			{
				newDirection += Math.PI;
			}
			zombie.direction = newDirection;
		}
	}

	zombie.x -= conf.zombie.speed * Math.sin(zombie.direction);
	zombie.y += conf.zombie.speed * Math.cos(zombie.direction);
}

function tickDragon()
{
	// console.log(dragon.state);
	// console.log(dragon.x, dragon.y);
	if(dragon.deadCounter >= 0)
	{
		if(--dragon.deadCounter === 0)
			return "dead";
		return;
	}

	if(dragon.attackCounter >= 0)
	{
		dragon.attackCounter--;
	}


	var minDist = conf.dragon.sight, dist = 0;
	if(dragon.state === 'idle')
	{

		if (!dragon.target || dragon.target.dead ||
		util.getDistance(dragon, dragon.target) >= conf.dragon.sight)
		{
			for(var i = 0; i < users.length; i++)
			{
				dist = util.getDistance(users[i], dragon);
				if (users[i].dead !== true)
				{
					if(dragon.attackCounter < 0 && dist < 0)
					{
						attackFunc(dragon, users[i]);
					}
					if (dist < minDist) {
						minDist = dist;
						dragon.target = users[i];
					}
				}
			}
		}

		if(dragon.target)
		{
			dragon.state = 'attack';
		}

		dragon.direction += 0.01;
		dragon.x -= conf.dragon.idleSpeed * Math.sin(dragon.direction);
		dragon.y += conf.dragon.idleSpeed * Math.cos(dragon.direction);
		return;
	}

	if(dragon.state === 'attack')
	{
		if (!dragon.target || dragon.target.dead || util.getDistance(dragon, center) > 1000)
		{
			dragon.target = center;
			dragon.state = 'return';
		}
		else if(util.getDistance(dragon, dragon.target) < 0)
		{
			if(dragon.attackCounter < 0)
			{
				if(attackFunc(dragon, dragon.target) === "dead")
				{
					dragon.target = null;
					return;
				}
			}
			return;
		}
	}
	if(dragon.state === 'return')
	{
		// console.log(util.getDistance(dragon, center));
		if(util.getDistance(dragon, center) < 100)
		{
			dragon.state = 'idle';
			dragon.target = null;
			return;
		}
	}

	if(dragon.target)
	{
		var newDirection = 0;
		if(dragon.target.y === dragon.y)
		{
			if(dragon.target.x < dragon.x)
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
			newDirection = Math.atan((dragon.x - dragon.target.x)/(dragon.target.y - dragon.y));
		}

		if(dragon.target.y-dragon.y < 0)
		{
			newDirection += Math.PI;
		}

		dragon.direction = newDirection;
		var speed = (dragon.state === 'attack') ? conf.dragon.attackSpeed: conf.dragon.idleSpeed;
		dragon.x -= speed * Math.sin(dragon.direction);
		dragon.y += speed * Math.cos(dragon.direction);
	}
}

function moveloop()
{
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


	for (i = 0; i < zombies.length; i++)
	{
		if(tickZombie(zombies[i]) === "dead")
		{
			zombies.splice(i, 1);
			i--;
		}
	}

	// for (i = 0; i < dragons.length; i++)
	// {
		if(tickDragon() === "dead")
		{
			// dragons.splice(i, 1);
			// i--;
		}
	// }

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
		  users.sort( function(a, b)
		  	{
		  		if (b.level !== a.level)
			  		return b.level - a.level;
			  	if(b.playerKills !== a.playerKills)
		  			return b.playerKills - a.playerKills;
			  	if(b.id !== a.id)
		  			return b.id - a.id;
			});

		  var topUsers = [];

		  for (var i = 0; i < Math.min(10, users.length); i++) {
				if(users[i].type == 'player' || users[i].type == 'fake') {
					 topUsers.push({
						  id: users[i].id,
						  name: users[i].name,
						  level: users[i].level
					 });
				}
		  }

		  if (!leaderboard || leaderboard.length !== topUsers.length) {
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
	 addCreatures();
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
							radius: mouse.radius,
							direction: mouse.direction,
							dead: mouse.dead
						};
					}
				}).filter(function(f) { return f; });

			var visibleSpiders  = spiders
				.map(function(spider) {
					if ( spider.x > u.x - u.screenWidth/2 - spider.radius &&
						spider.x < u.x + u.screenWidth/2 + spider.radius &&
						spider.y > u.y - u.screenHeight/2 - spider.radius &&
						spider.y < u.y + u.screenHeight/2  + spider.radius) {
						return {
							x: spider.x,
							y: spider.y,
							hp: spider.hp,
							maxHP: spider.maxHP,
							radius: spider.radius,
							direction: spider.direction,
							dead: spider.dead
						};
					}
				}).filter(function(f) { return f; });

				var visibleZombies  = zombies
				.map(function(zombie) {
					if ( zombie.x > u.x - u.screenWidth/2 - zombie.radius &&
						zombie.x < u.x + u.screenWidth/2 + zombie.radius &&
						zombie.y > u.y - u.screenHeight/2 - zombie.radius &&
						zombie.y < u.y + u.screenHeight/2  + zombie.radius) {
						return {
							x: zombie.x,
							y: zombie.y,
							hp: zombie.hp,
							maxHP: zombie.maxHP,
							radius: zombie.radius,
							direction: zombie.direction,
							dead: zombie.dead
						};
					}
				}).filter(function(f) { return f; });

				// var visibleDragons  = dragons
				// .map(function(dragon) {
					// if ( dragon.x > u.x - u.screenWidth/2 - dragon.radius &&
						// dragon.x < u.x + u.screenWidth/2 + dragon.radius &&
				// 		dragon.y > u.y - u.screenHeight/2 - dragon.radius &&
				// 		dragon.y < u.y + u.screenHeight/2  + dragon.radius) {
				// 		return {
				// 			x: dragon.x,
				// 			y: dragon.y,
				// 			hp: dragon.hp,
				// 			maxHP: dragon.maxHP,
				// 			radius: dragon.radius,
				// 			direction: dragon.direction,
				// 			dead: dragon.dead
				// 		};
				// 	}
				// }).filter(function(f) { return f; });

			var visiblePlayers  = users
			.map(function(user) {
				if ( user.x+user.radius > u.x - u.screenWidth/2 - 20 &&
					user.x-user.radius < u.x + u.screenWidth/2 + 20 &&
					user.y+user.radius > u.y - u.screenHeight/2 - 20 &&
					user.y-user.radius < u.y + u.screenHeight/2 + 20)
				{
					return {
						x: user.x,
						y: user.y,
						hp: user.hp,
						maxHP: user.maxHP,
						radius: user.radius,
						attacking: user.attackCounter > 0,
					};
				}
			})
			.filter(function(f) {return f;});


			sockets[u.id].emit('serverTellPlayerMove', {
				players: visiblePlayers,
				mice: 	visibleMice,
				spiders: visibleSpiders,
				zombies: visibleZombies,
				dragons: [dragon]
			}, u);
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
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || process.env.KEREKT_PORT || conf.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
	 http.listen( serverport, ipaddress, function() {
		  console.log('[DEBUG] Listening on *:' + serverport);
	 });
} else {
	 http.listen( serverport, function() {
		  console.log('[DEBUG] Listening on *:' + serverport);
	 });
}
