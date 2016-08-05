'use strict';

module.exports = function(io) {

	let express = require('express');
	let app = express();
	// let http = require('http').Server(app);
	// let io = require('socket.io')(http);

	var game_server = io.of('/game_io');

	// Import game settings.
	let conf = require('../config.json');

	// Import utilities.
	let util = require('./lib/util');

	let args = {x: 0, y: 0, h: conf.gameHeight, w: conf.gameWidth};
	console.log(args);


	let users = [];
	let mice = [];
	let spiders = [];
	let zombies = [];
	let dragon = {
		type: 'dragon',
		x: conf.gameWidth/2, //position.x,
		y: conf.gameHeight/2, //position.y,
		radius: conf.dragon.radius,
		state: 'idle',
		hp: conf.dragon.hp,
		maxHP: conf.dragon.hp,
		attack: conf.dragon.attack,
		direction: Math.random() * 2 * Math.PI,
		attackCounter: -1};


	let projectiles = [];

	let sockets = {};

	let center = {
		x: conf.gameWidth/2,
		y: conf.gameHeight/2,
		radius: 5
	};

	let realPlayers = 0;


	let leaderboard = [];
	let leaderboardChanged = false;

	app.use(express.static(__dirname + '/../client'));

	function addMice() {
		while (mice.length < conf.mouse.amount) {
			mice.push({
				id: ((new Date()).getTime() + '' + mice.length) >>> 0,
				type: 'mouse',
				hp: conf.mouse.hp,
				maxHP: conf.mouse.hp,
				radius: conf.mouse.radius,
				attack: conf.mouse.attack,
				y: Math.random() * conf.gameWidth,
				x: Math.random() * conf.gameHeight,
				direction: Math.random() * 2 * Math.PI
		  });
		}
	}

	function addSpiders() {
		while (spiders.length < conf.spider.amount) {
			let spiderType = util.randomInRange(2,5);

			spiders.push({
				id: ((new Date()).getTime() + '' + spiders.length) >>> 0,
				type: 'spider',
				hp: conf.spider.hp * spiderType,
				maxHP: conf.spider.hp * spiderType,
				radius: 10 * spiderType + 10,
				attack: conf.spider.attack * spiderType,
				y: Math.random() * conf.gameWidth,
				x: Math.random() * conf.gameHeight,
				direction: Math.random() * 2 * Math.PI,
				attackCounter: -1
			});
		}
	}

	function addZombies() {
		while (zombies.length < Math.min(conf.zombie.amount, realPlayers + 1)) {
			zombies.push({
				id: ((new Date()).getTime() + '' + zombies.length) >>> 0,
				type: 'zombie',
				dragonCounter: -1,
				hp: conf.zombie.hp,
				maxHP: conf.zombie.hp,
				radius: conf.zombie.radius,
				attack: conf.zombie.attack,
				y: Math.random() * conf.gameWidth,
				x: Math.random() * conf.gameHeight,
				direction: Math.random() * 2 * Math.PI,
				attackCounter: -1
			});
		}
	}

	function addPlayers()
	{
		let radius = util.levelToRadius(0);
		while(users.length < conf.AIUsers)
		{
			let position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);
			let name = util.randomName();
			users.push(
			{
				id: ((new Date()).getTime() + '' + users.length) >>> 0,
				xp: 0,
				level: 0,
				name: name,
				type: 'fake',
				x: position.x,
				y: position.y,
				radius: radius,
				class: 'peasant',
				hp: conf.playerHp[0],
				maxHP: conf.playerHp[0],
				speed: conf.peasant.speed,
				attack: conf.peasant.attack[0],
				attackCounter: -1,
				playerKills: 0,
				kills : {
					mouse: 0,
					spider: 0,
					zombie: 0,
					dragon: 0,
					player: 0
				}
			});
			game_server.emit('playerJoin', { name: name });
		}
	}


	function movePlayer(player)
	{
		if(player.type === 'spectator') return;

		if(player.type == 'fake')
		{
			if(!player.target || player.target.dead)
			{
				let distMice = mice.sort(function(obj1,obj2) {
					return util.getDistance(player, obj1) - util.getDistance(player, obj2);
				});

				player.target = distMice[util.randomInRange(0, 5)];
		   	player.moveTarget = player.target;
			}
		}

		if(!player.moveTarget) return;

		if((player.moveTarget.x !== 0 || player.moveTarget.y !== 0) && util.getDistance(player, player.moveTarget, false) > 30)
		{
			let deg;
			if (player.type === 'player')
				deg = util.getDirection({x: 0, y: 0}, player.moveTarget);
			else
				deg = util.getDirection(player, player.moveTarget);

			player.x -= player.speed * Math.sin(deg);
			player.y += player.speed * Math.cos(deg);
		}

		if (player.x > conf.gameWidth)
			player.x = conf.gameWidth;

		if (player.y > conf.gameHeight)
			player.y = conf.gameHeight;

		if (player.x < 0)
			player.x = 0;

		if (player.y < 0)
			player.y = 0;
	}

	function addCreatures()
	{
		addMice();
		addSpiders();
		addZombies();
		addPlayers();
	}



	game_server.on('connection', function (socket)
	{
		console.log('A user connected! ', socket.handshake.query.type, ' ', ++realPlayers);

		let type = socket.handshake.query.type;

		let currentPlayer = {
			type: type,
			id: socket.id,
			lastHeartbeat: new Date().getTime(),
			attackCounter: -1,
			projectileCounter: -1,
			target: {
				x: 0,
				y: 0
			}
		};

		socket.on('gotit', function (player)
		{
		   console.log('[INFO] Player ' + player.name + ' connecting!');
			if (util.findUserById(users, player.id) > -1)
			{
				console.log('[INFO] Player ID is already connected, kicking.');
				socket.disconnect();
			}
			else if (!util.validNick(player.name))
			{
				socket.emit('kick', 'Invalid username.');
				socket.disconnect();
			}
			else
			{
				console.log('[INFO] Player ' + player.name + ' connected!');

				if(!player.name)
				{
					player.name = util.randomName();
				}

				sockets[player.id] = socket;
				currentPlayer = player;

				if(currentPlayer.type !== 'spectator')
				{
					let position = util.newPlayerPos(conf.gameWidth/2);
					console.log(position);
					let radius = util.levelToRadius(0);
					currentPlayer.dead = false;
					currentPlayer.xp = 0;
					currentPlayer.level = 0;
					currentPlayer.class = 'peasant';
					currentPlayer.hp = conf.playerHp[0];
					currentPlayer.maxHP = conf.playerHp[0];
					currentPlayer.attack = conf.peasant.attack[0];
					currentPlayer.speed = conf.peasant.speed; // conf.playerSpeed[0];
					currentPlayer.x =  position.x;
					currentPlayer.y =  position.y;
					currentPlayer.radius = radius;
					currentPlayer.skill = undefined;
					currentPlayer.kills = {
						mouse: 0,
						spider: 0,
						zombie: 0,
						dragon: 0,
						player: 0
					};
					game_server.emit('playerJoin', { name: player.name });
				}

				users.push(currentPlayer);
				socket.emit('gameSetup', {
					 gameWidth: conf.gameWidth,
					 gameHeight: conf.gameHeight
				});
				console.log('Total players: ' + users.length);
			}
		});

		socket.on('ping', function ()
		{
			socket.emit('pong');
		});

		socket.on('windowResized', function (data)
		{
			currentPlayer.screenWidth = data.screenWidth;
			currentPlayer.screenHeight = data.screenHeight;
		});

		socket.on('respawn', function (type)
		{
		 	currentPlayer.type = type;
			if (util.findUserById(users, currentPlayer.id) > -1)
				users.splice(util.findUserById(users, currentPlayer.id), 1);
			socket.emit('welcome', currentPlayer, {xpLevels: conf.xpForLevel});
			console.log('[INFO] User ' + currentPlayer.name + ' respawned!');
		});

		 socket.on('disconnect', function ()
		 {
			  if (util.findUserById(users, currentPlayer.id) > -1)
					users.splice(util.findUserById(users, currentPlayer.id), 1);
			  console.log('[INFO] User ' + currentPlayer.name + ' disconnected!');

			  socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
			  realPlayers --;
		 });

		 socket.on('playerChat', function(data)
		 {
			  let _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
			  let _message = data.message.replace(/(<([^>]+)>)/ig, '');
			  if (conf.logChat === 1) {
					console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
			  }
			  socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
		 });

		 socket.on('pass', function(data)
		 {
			  if (data[0] === conf.adminPass)
			  {
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

		 socket.on('kick', function(data)
		 {
			  if (currentPlayer.admin)
			  {
					let reason = '';
					let worked = false;
					for (let e = 0; e < users.length; e++)
					{
						 if (users[e].name === data[0] && !users[e].admin && !worked)
						 {
							  if (data.length > 1) {
									for (let f = 1; f < data.length; f++)
									{
										 if (f === data.length)
											  reason = reason + data[f];
										 else
											  reason = reason + data[f] + ' ';
									}
							  }
							  if (reason !== '')
								  console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
							  else
								  console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name);
							  socket.emit('serverMSG', 'User ' + users[e].name + ' was kicked by ' + currentPlayer.name);
							  sockets[users[e].id].emit('kick', reason);
							  sockets[users[e].id].disconnect();
							  users.splice(e, 1);
							  worked = true;
					}
				}
				if (!worked)
					socket.emit('serverMSG', 'Could not locate user or user is an admin.');
			}
			else
			{
				console.log('[ADMIN] ' + currentPlayer.name + ' is trying to use -kick but isn\'t an admin.');
				socket.emit('serverMSG', 'You are not permitted to use this command.');
			}
		});

		socket.on('attack', function()
		{
			currentPlayer.attacking = true;
		});

		socket.on('stopAttack', function()
		{
			currentPlayer.attacking = false;
		});

		socket.on('upgrade', function(_class)
		{
			currentPlayer.class = _class;
			console.log(_class, conf[_class]);
			currentPlayer.hp += conf[_class].hp;
			currentPlayer.maxHP += conf[_class].hp;
			currentPlayer.speed += conf[_class].speed;
			if(conf[_class].attackOff)
			{
				currentPlayer.attack += conf[_class].attackOff;
				console.log('upgrade');
			}
			else
			{
				currentPlayer.attack = 0;
				console.log('no upgrade');
			}
		});

		socket.on('skill', function(skill)
		{
			currentPlayer.skill = skill;
		});

		socket.on('space', function()
		{

		});

		// Heartbeat function, update everytime.
		socket.on('0', function(target,  moveTarget) {
			currentPlayer.lastHeartbeat = new Date().getTime();
			currentPlayer.moveTarget = moveTarget;
			currentPlayer.target = target;
		});
	});

	function attackFunc(p1, p2)
	{
		p1.attackCounter = conf.counters.attack;
		p2.hp -= p1.attack * Math.sqrt(p1.attack) * 2;

		if(p2.hp <= 0)
		{
			killFunc(p2, p1);
			return 'dead';
		}
		else
		{
			retaliation(p1, p2);
		}
	}


	function retaliation(p1, p2)
	{
		if(p2.type !== 'player')
		{
			if(p2.type === 'dragon')
			{
				p2.state = 'attack';
				p2.target = p1;
			}
			else if (p2.type === 'fake')
			{
				if(p1.type === 'zombie' || p1.type === 'fake' ||p1.type === 'dragon' || p1.type === 'player' && p1.attack > p2.attack)
					return;
				else
				{
					p2.moveTarget = p1;
					p2.target = p1;
				}
			}
			else
			{
				p2.target = p1;
			}
		}
	}

	function killFunc(creature, player)
	{
		if(creature.name === 'debug') return;

		creature.dead = true;
		creature.deadCounter = conf.counters.dead;


		if(player && (player.type === 'fake' || player.type === 'player'))
		{
			let xpOff = (player.type==='fake'? conf.xpFactor : 1);
			let healthOff = (player.type==='fake'? conf.healthFactor : 1);

			if(creature.type === 'player' || creature.type === 'fake')
				player.xp += conf.xpForKill[creature.level] * xpOff;
			else
				player.xp += conf[creature.type].xp * xpOff;


			let plural = creature.type + 's';
			if(creature.type === 'mouse')
			{
				plural = 'mice';
				player.hp = Math.min(player.maxHP, player.hp + player.maxHP * 0.05 * healthOff);
			}

			if(player.type === 'player')
			{
				if(creature.type === 'fake')
					player.kills.player++;
				else
					player.kills[creature.type]++;



				let kills = player.kills[creature.type];
				if(kills === 1)
				{
					sockets[player.id].emit('achievement', {txt: 'Killed your first '+ creature.type  +'!', counter: conf.counters.achievement});
				}
				else if (kills === 10 || kills === 50 || kills === 100)
				{
					let xpGained;
					if(conf[creature.type])
					{
						xpGained = kills * conf[creature.type].xp;
						player.xp += xpGained;
					}
					sockets[player.id].emit('achievement', {txt: 'Killed '+kills+' '+ plural +'! +' + xpGained + ' xp', counter: conf.counters.achievement});
				}
			}
		}
	}

	function distanceCheck(creature, others, distance, type, id2)
	{
		let minTarget = {}, minDist = distance;
		for (let i = 0; i < others.length; i++)
		{
			let dist = util.getDistance(others[i], creature);
			if(creature.id !== others[i].id && id2 !== others[i].id && !others[i].dead && dist < minDist)
			{
				minDist = dist;
				minTarget =  {target: others[i], type: type, dist: dist};
			}
		}
		return minTarget;
	}

	function tickPlayer(currentPlayer)
	{

		if(currentPlayer.type === 'spectator') return;

		if(currentPlayer.deadCounter >= 0)
		{
			if(--currentPlayer.deadCounter === 0)
				return 'dead';
			return;
		}

		if(currentPlayer.attackCounter >= 0)
			currentPlayer.attackCounter--;


		if(currentPlayer.lastHeartbeat < new Date().getTime() - conf.maxHeartbeatInterval) {
			sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + conf.maxHeartbeatInterval/1000.0 + ' seconds ago.');
			sockets[currentPlayer.id].disconnect();
		}

		movePlayer(currentPlayer);

		if(currentPlayer.type == 'fake' || currentPlayer.attacking === true)
		// if(currentPlayer.attacking === true)
		{

			if(currentPlayer.attackCounter < 0)
			{
				let type, radius = 1, damage = 1;
				if(currentPlayer.class === 'mage')
				{
					type = 'fire';
					if (currentPlayer.skill  === 'fire')
					{
						radius = 1.5;
						damage = 1.5;
					}
					else if (currentPlayer.skill === 'lightning')
					{
						currentPlayer.attackCounter = conf.lightning.counter;
						checkXp(currentPlayer);
						return lightning(currentPlayer);
					}
				}
				else if(currentPlayer.class === 'archer')
				{
					type = 'arrow';
					if(currentPlayer.skill === 'arrow')
					{
						radius = 1.2;
						damage = 1.5;
					}
				}

				if(type)
				{
					let direction;
					if (currentPlayer.type === 'fake')
						direction = util.getDirection(currentPlayer, currentPlayer.target);
					else
						direction = util.getDirection({x:0, y:0}, currentPlayer.target);


					currentPlayer.attackCounter = conf[type].counter;
					projectiles.push(
					{
						type: type,
						x: currentPlayer.x,
						y: currentPlayer.y,
						user: currentPlayer,
						direction: direction,
						speed: conf[type].speed,
						range: conf[type].range,
						radius: conf[type].radius * radius,
						damage: (conf[type].damage + currentPlayer.attack) * damage,
					});


					if(currentPlayer.skill === 'arrow_three')
					{
						currentPlayer.attackCounter *= 2;
						projectiles.push(
						{
							x: currentPlayer.x,
							y: currentPlayer.y,
							user: currentPlayer,
							direction: direction + 0.2,
							type: type,
							speed: conf[type].speed,
							range: conf[type].range,
							radius: conf[type].radius * radius,
							damage: (conf[type].damage + currentPlayer.attack) * damage,
						});
						projectiles.push(
						{
							x: currentPlayer.x,
							y: currentPlayer.y,
							user: currentPlayer,
							direction: direction - 0.2,
							type: type,
							speed: conf[type].speed,
							range: conf[type].range,
							radius: conf[type].radius * radius,
							damage: (conf[type].damage + currentPlayer.attack) * damage,
						});
					}
				}
				else
				{

					let target = {};
					if(currentPlayer.type === 'fake' || currentPlayer.attacking)
					{
						if(!target.target) target = distanceCheck(currentPlayer, mice, 0, 'mouse');
						if(!target.target) target = distanceCheck(currentPlayer, users, 0, 'player');
						if(dragon.state !== 'egg' && !target.target) target = distanceCheck(currentPlayer, [dragon], 0, 'dragon');
						if(!target.target) target = distanceCheck(currentPlayer, zombies, 0, 'zombie');
						if(!target.target) target = distanceCheck(currentPlayer, spiders, 0, 'spider');
					}

					if(target.target && currentPlayer.attackCounter < 0 && attackFunc(currentPlayer, target.target) === 'dead')
					{
						if(currentPlayer.type === 'fake')
							currentPlayer.target = undefined;
					}
				}
				checkXp(currentPlayer);
			}
		}
	}

	function lightning(currentPlayer)
	{
		let times = conf.lightning.times;
		let nextTarget = currentPlayer;
		while(times-- >= 0)
		{
			let target = distanceCheck(nextTarget, users, conf.lightning.link, '', currentPlayer.id);
			if(!target.target) target = distanceCheck(nextTarget, [dragon], conf.lightning.link);
			if(!target.target) target = distanceCheck(nextTarget, zombies, conf.lightning.link);
			if(!target.target) target = distanceCheck(nextTarget, spiders, conf.lightning.link);
			if(!target.target) target = distanceCheck(nextTarget, mice, conf.lightning.link);

			if(target.target)
			{
				target.target.hp -= conf.lightning.damage + (currentPlayer.level-4) * 4;
				retaliation(currentPlayer, target.target);
				if(target.target.hp <= 0)
					killFunc(target.target, currentPlayer);


				projectiles.push(
				{
					type: "lightning",
					x: nextTarget.x,
					y: nextTarget.y,
					dist: util.getDistance(target.target, nextTarget, false),
					radius: 1,
					direction: util.getDirection(nextTarget, target.target),
					stayCounter: conf.lightning.stayCounter
				});

				nextTarget = target.target;
			}
			else
			{
				times = -1;
			}
		}
	}

	function checkXp(currentPlayer)
	{
		if(currentPlayer.xp >= conf.xpForLevel[currentPlayer.level])
			{
				currentPlayer.xp -= conf.xpForLevel[currentPlayer.level];
				currentPlayer.level++;


				if(currentPlayer.level == 2)
				{
					if(currentPlayer.type === 'fake')
					{
						let classes = ['mage', 'archer', 'knight'];
						currentPlayer.class = classes[Math.floor(Math.random() * 3)];
					}
					else
					{
						sockets[currentPlayer.id].emit('LVL2');
					}
				}
				else if(currentPlayer.level == 5)
				{
					if(currentPlayer.type === 'fake')
					{
						if(currentPlayer.class === 'mage')
							currentPlayer.skill = ['fire', 'lightning'][Math.floor(Math.random() * 2)];
						else if (currentPlayer.class === 'archer')
							currentPlayer.skill = ['arrow', 'arrow_three'][Math.floor(Math.random() * 2)];
					}
					else
					{
						if(currentPlayer.class === 'mage')
							sockets[currentPlayer.id].emit('LVL5', 'fire', 'lightning');
						else if (currentPlayer.class === 'archer')
							sockets[currentPlayer.id].emit('LVL5', 'arrow', 'arrow_three');
					}
				}

				currentPlayer.hp += conf.playerHp[currentPlayer.level];
				currentPlayer.maxHP += conf.playerHp[currentPlayer.level];
				currentPlayer.attack += conf[currentPlayer.class].attack[currentPlayer.level];
				currentPlayer.radius = util.levelToRadius(currentPlayer.level);
			}
	}

	function tickMouse(mouse)
	{
		if(mouse.deadCounter >= 0)
		{
			if(--mouse.deadCounter === 0)
				return 'dead';
			return;
		}
		let dx = -conf.mouse.speed * Math.sin(mouse.direction);
		let dy = conf.mouse.speed * Math.cos(mouse.direction);
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
				return 'dead';
			return;
		}

		let minDist = conf.spider.sight, dist = 0;

		if(spider.attackCounter >= 0)
		{
			spider.attackCounter--;
		}

		if(!spider.target || util.getDistance(spider, spider.target) >= conf.spider.sight * 1.2 || spider.target.dead)
		{

			let distMice = mice.sort(function(obj1,obj2)
			{
				return util.getDistance(spider, obj1) - util.getDistance(spider, obj2);
			});
			spider.target = distMice[util.randomInRange(0, 5)];

			if(util.getDistance(spider, spider.target) > conf.spider.sight)
			{
				let distUsers = users.sort(function(obj1,obj2)
				{
					return util.getDistance(spider, obj1) - util.getDistance(spider, obj2);
				});
				spider.target = distUsers[util.randomInRange(0, 5)];
				if(spider.target.type === 'spectator') spider.target = undefined;
			}
		}

		if (spider.target)
		{
			if(spider.attackCounter < 0 && util.getDistance(spider, spider.target) < 0)
			{
				if(attackFunc(spider, spider.target) === 'dead')
				{
					spider.target = null;
					return;
				}
			}

			spider.direction = util.getDirection(spider, spider.target);
			if(util.getDistance(spider, spider.target) > 0)
			{
				spider.x -= conf.spider.speed * Math.sin(spider.direction);
				spider.y += conf.spider.speed * Math.cos(spider.direction);
			}
		}
	}

	function tickZombie(zombie)
	{
		if(zombie.deadCounter >= 0)
		{
			if(--zombie.deadCounter === 0)
				return 'dead';
			return;
		}

		if(zombie.attackCounter >= 0)
		{
			zombie.attackCounter--;
		}

		if(zombie.dragonCounter >= 0)
		{
			zombie.dragonCounter--;
		}


		if(!dragon.dead && util.getDistance(zombie, dragon) < conf.zombie.sight)
		{
			// console.log("close to dragon: ", util.getDistance(zombie, dragon));

			if(zombie.dragonCounter === -1)
			{
				zombie.target = null;
				zombie.dragonCounter = 50;
				zombie.direction = util.getDirection(zombie, dragon) + Math.PI;
			}
			// console.log("zombie: ", zombie);
			// console.log("dragon: ", dragon);
		}
		else
		{
			if(!zombie.target  || zombie.target.dead)
			{
				if(leaderboard.length > 0)
				{
					let id = leaderboard[util.zombieFunc(leaderboard.length)].id;
					zombie.target = users[util.findUserById(users, id)];
					// if(zombie.target)
					// console.log("new target: ", zombie.target.name);
				}
			}

			if (zombie.target)
			{
				if(zombie.attackCounter < 0 && util.getDistance(zombie, zombie.target) < 0 &&
					attackFunc(zombie, zombie.target) === 'dead')
				{
					zombie.target = null;
					// console.log("target terminated");
					return;
				}

				zombie.direction = util.getDirection(zombie, zombie.target);
			}
		}

		zombie.x -= conf.zombie.speed * Math.sin(zombie.direction);
		zombie.y += conf.zombie.speed * Math.cos(zombie.direction);
	}

	function tickDragon()
	{
		if(dragon.deadCounter > 0)
		{
			if(--dragon.deadCounter === 0)
			{
				dragon.x = center.x;
				dragon.y = center.y;
				dragon.state = 'egg';
				dragon.eggCounter = conf.dragon.eggCounter;
				dragon.dead = false;
				dragon.direction = 0;
			}
			return;
		}

		if(dragon.state === 'egg')
		{
			if(--dragon.eggCounter === 0)
			{
				dragon.state = 'idle';
				dragon.hp = conf.dragon.hp / 2;
				dragon.maxHP = conf.dragon.hp / 2;
				dragon.radius = conf.dragon.radius / 2;
				dragon.attack = conf.dragon.attack / 2;
				dragon.babyCounter = conf.dragon.babyCounter;
			}
			return;
		}

		if(dragon.babyCounter > 0)
		{
			dragon.radius = (2 - dragon.babyCounter / conf.dragon.babyCounter) * 0.5 * conf.dragon.radius;
			if(--dragon.babyCounter === 0)
			{
				dragon.maxHP = conf.dragon.hp;
				dragon.hp += conf.dragon.hp / 2;
				dragon.radius = conf.dragon.radius;
				dragon.attack = conf.dragon.attack;
			}
		}

		if(dragon.attackCounter >= 0)
			dragon.attackCounter--;

		// let minDist = conf.dragon.sight;
		if(dragon.state === 'idle')
		{

			if (!dragon.target || dragon.target.dead ||
			util.getDistance(dragon, dragon.target) >= conf.dragon.sight)
			{
				dragon.target = distanceCheck(dragon, users, conf.dragon.sight).target;
			}

			if(dragon.target)
			{
				dragon.state = 'attack';
			}

			dragon.direction += 0.005;
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
					if(attackFunc(dragon, dragon.target) === 'dead')
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
			dragon.direction = util.getDirection(dragon, dragon.target);
			let speed = (dragon.state === 'attack') ? conf.dragon.attackSpeed: conf.dragon.idleSpeed;
			if(dragon.babyCounter > 0) speed *= 0.5;
			dragon.x -= speed * Math.sin(dragon.direction);
			dragon.y += speed * Math.cos(dragon.direction);
		}
	}

	function projectileHit(creatures, projectile)
	{
		for (let i = 0; i < creatures.length; i++) {
			if(projectile.user.id !== creatures[i].id  && !creatures[i].dead && util.getDistance(creatures[i], projectile) < 0)
			{
				creatures[i].hp -= projectile.damage;
				retaliation(projectile.user, creatures[i]);
				if(creatures[i].hp <= 0)
					killFunc(creatures[i], projectile.user);
				return 'dead';
			}
		}
	}

	function tickProjectile(projectile)
	{

		if(projectile.type === 'lightning')
		{
			if(projectile.stayCounter-- < 0)
				return 'dead';
			return;
		}


		if(projectileHit(users, projectile) === 'dead' || (dragon.state !== 'egg' && projectileHit([dragon], projectile) === 'dead') || projectileHit(zombies, projectile) === 'dead' || projectileHit(spiders, projectile) === 'dead' || projectileHit(mice, projectile) === 'dead')
		{
			return 'dead';
		}

		projectile.x -= projectile.speed * Math.sin(projectile.direction);
		projectile.y += projectile.speed * Math.cos(projectile.direction);
		projectile.range -= projectile.speed;

		if(projectile.range < 0)
			return 'dead';
	}

	function moveloop()
	{
		for (let i = 0; i < mice.length; i++)
		{
			if (tickMouse(mice[i]) === 'dead')
			{
				mice.splice(i,1);
				i--;
			}
		}
		for (let i = 0; i < spiders.length; i++)
		{
			if(tickSpider(spiders[i]) === 'dead')
			{
				spiders.splice(i, 1);
				i--;
			}
		}


		for (let i = 0; i < zombies.length; i++)
		{
			if(tickZombie(zombies[i]) === 'dead')
			{
				zombies.splice(i, 1);
				i--;
			}
		}

		if(tickDragon() === 'dead')
		{
			// ????
		}

		for (let i = 0; i < users.length; i++)
		{
			if(tickPlayer(users[i]) === 'dead')
			{
				game_server.emit('playerDied', { name: users[i].name });
				if(users[i].type != 'fake')
				{
					sockets[users[i].id].emit('RIP');
				}
				users.splice(i, 1);
				i--;
			}
		}

		for (let i = 0; i < projectiles.length; i++)
		{
			if(tickProjectile(projectiles[i]) === 'dead')
			{
				projectiles.splice(i, 1);
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
				  	if(b.kills.player !== a.kills.player)
			  			return b.kills.player - a.kills.player;
		  			return b.xp - a.xp;
				});

			  let topUsers = [];

			  for (let i = 0; i < Math.min(10, users.length); i++) {
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
					for (let i = 0; i < leaderboard.length; i++) {
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
				// u.x = u.x || conf.gameWidth / 2;
				// u.y = u.y || conf.gameHeight / 2;



				/*
					uses filter to get rid of undefined values
				*/
				let visibleMice  = mice
					.map(function(mouse) {
						if ( u.type === 'spectator' || mouse.x > u.x - u.screenWidth/2 - 20 &&
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

				let visibleSpiders  = spiders
					.map(function(spider) {
						if ( u.type === 'spectator' || spider.x > u.x - u.screenWidth/2 - spider.radius &&
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

				let visibleZombies  = zombies
					.map(function(zombie) {
						if ( u.type === 'spectator' || zombie.x > u.x - u.screenWidth/2 - zombie.radius &&
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



				let visiblePlayers  = users
				.map(function(user) {
					if ( u.type === 'spectator' || user.x+user.radius > u.x - u.screenWidth/2 - 20 &&
						user.x-user.radius < u.x + u.screenWidth/2 + 20 &&
						user.y+user.radius > u.y - u.screenHeight/2 - 20 &&
						user.y-user.radius < u.y + u.screenHeight/2 + 20)
					{
						if(user.type !== 'spectator')
						return {
							x: user.x,
							y: user.y,
							hp: user.hp,
							dead: user.dead,
							name: user.name,
							level: user.level,
							class: user.class,
							maxHP: user.maxHP,
							radius: user.radius,
							attacking: user.attackCounter > 0,
							direction: (user.target && user.target.x < 0 ? 'left' : 'right'),
						};
					}
				})
				.filter(function(f) {return f;});

				let visibleProjectiles = projectiles
				.map(function(projectile)
				{
					if (u.type === 'spectator' || projectile.type === 'lightning' || projectile.x+projectile.radius > u.x - u.screenWidth/2 - 20 &&
						projectile.x-projectile.radius < u.x + u.screenWidth/2 + 20 &&
						projectile.y+projectile.radius > u.y - u.screenHeight/2 - 20 &&
						projectile.y-projectile.radius < u.y + u.screenHeight/2 + 20)
					{
						return {
							x: projectile.x,
							y: projectile.y,
							type: projectile.type,
							radius: projectile.radius,
							direction: projectile.direction,
							dist: projectile.dist
						};
					}
				}).filter(function(f) {return f;});


				sockets[u.id].emit('serverTellPlayerMove', {
					players: visiblePlayers,
					mice: 	visibleMice,
					spiders: visibleSpiders,
					zombies: visibleZombies,
					dragons: [{
						x: dragon.x,
						y: dragon.y,
						hp: dragon.hp,
						dead: dragon.dead,
						maxHP: dragon.maxHP,
						state: dragon.state,
						radius: dragon.radius,
						baby: dragon.babyCounter > 0,
						direction: dragon.direction,

					}],
					projectiles: visibleProjectiles
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

	return function() {
		setInterval(moveloop, 1000 / 60);
		setInterval(gameloop, 1000);
		setInterval(sendUpdates, 1000 / conf.gameFPS);
	};
}



	// Don't touch, IP configurations.
	// let ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
	// let serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || process.env.KEREKT_PORT || conf.port;
	// if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
	// 	 http.listen( serverport, ipaddress, function() {
	// 		  console.log('[DEBUG] Listening on *:' + serverport);
	// 	 });
	// } else {
	// 	 http.listen( serverport, function() {
	// 		  console.log('[DEBUG] Listening on *:' + serverport);
	// 	 });
	// }