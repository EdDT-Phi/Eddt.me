var io = require('socket.io-client');

var playerName;
var playerType;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ESC = 27;
var KEY_ENTER = 13;
var KEY_SPACE = 32;
var KEY_LEFT = 37;
var KEY_UP = 38;
var KEY_RIGHT = 39;
var KEY_DOWN = 40;
var KEY_W = 87;
var KEY_A = 65;
var KEY_S = 83;
var KEY_D = 68;
var borderDraw = true;
var animLoopHandle;
var mobile = false;


var mouse = {
  image: new Image(),
  size: 40
}; mouse.image.src = 'img/mouse.png';

var skull = {
	image : new Image()
}; skull.image.src = 'img/skull.ico';

var grass = {
  image: new Image(),
  size: 50
}; grass.image.src = 'img/grass.png';


var projectile_types = {
 	fire: {
  		image: new Image()
  	},
  	arrow: {
  		image: new Image()
  	},
  	lightning: {
  		image: new Image()
  	}
};

projectile_types.fire.image.src = 'img/fire.png';
projectile_types.arrow.image.src = 'img/arrow.png';
projectile_types.lightning.image.src = 'img/lightning.png';

var classes = {
	knight : {
	  	image: new Image(),
		attack_image: new Image(),
		image_left: new Image(),
		attack_image_left: new Image(),
	},
	peasant : {
	  	image: new Image(),
		attack_image: new Image(),
		image_left: new Image(),
		attack_image_left: new Image(),
	},
	mage : {
	  	image: new Image(),
		attack_image: new Image(),
		image_left: new Image(),
		attack_image_left: new Image(),
	},
	archer : {
	  	image: new Image(),
		attack_image: new Image(),
		image_left: new Image(),
		attack_image_left: new Image(),
	},
};

classes.knight.image.src = 'img/knight.png';
classes.knight.attack_image.src = 'img/knight_attack.png';
classes.knight.image_left.src = 'img/knight_left.png';
classes.knight.attack_image_left.src = 'img/knight_attack_left.png';

classes.peasant.image.src = 'img/peasant.png';
classes.peasant.attack_image.src = 'img/peasant_attack.png';
classes.peasant.image_left.src = 'img/peasant_left.png';
classes.peasant.attack_image_left.src = 'img/peasant_attack_left.png';

classes.archer.image.src = 'img/archer.png';
// classes.archer.attack_image.src = 'img/archer_attack.png';
classes.archer.attack_image.src = 'img/archer.png';
classes.archer.image_left.src = 'img/archer_left.png';
// classes.archer.attack_image_left.src = 'img/archer_attack_left.png';
classes.archer.attack_image_left.src = 'img/archer_left.png';

classes.mage.image.src = 'img/mage.png';
// classes.mage.attack_image.src = 'img/mage_attack.png';
classes.mage.attack_image.src = 'img/mage.png';
classes.mage.image_left.src = 'img/mage_left.png';
// classes.mage.attack_image_left.src = 'img/mage_attack_left.png';
classes.mage.attack_image_left.src = 'img/mage_left.png';

var tree = {
  image: new Image(),
  size: 250
}; tree.image.src = 'img/tree.jpg';

var spider = {
  image: new Image(),
  size: 100
}; spider.image.src = 'img/spider.png';

var zombie = {
  image: new Image(),
  size: 100
}; zombie.image.src = 'img/zombie.png';

var dragon = {
  image: new Image(),
  size: 300
}; dragon.image.src = 'img/dragon.png';



var debug = function(args) {
	if (console && console.log) {
		console.log(args);
	}
};

if ( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) )
{
	mobile = true;
}

function startGame(type) {
	playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0,25);
	playerType = type;


	screenWidth = window.innerWidth;
	screenHeight = window.innerHeight;

	document.getElementById('startMenuWrapper').style.maxHeight = '0px';
	document.getElementById('gameAreaWrapper').style.opacity = 1;

	hideAll();

	if (!socket) {
		socket = io({query:'type=' + type});
		setupSocket(socket);
	}
	if (!animLoopHandle)
		animloop();
	socket.emit('respawn', type);
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
	var regex = /^\w*$/;
	debug('Regex Test', regex.exec(playerNameInput.value));
	return regex.exec(playerNameInput.value) !== null;
}

window.onload = function() {

	var btn = document.getElementById('startButton'),
		btnS = document.getElementById('spectateButton'),
		nickErrorText = document.querySelector('#startMenu .input-error');

	btnS.onclick = function () {
		startGame('spectator');
	};
	btn.onclick = function () {

		// Checks if the nick is valid.
		if (validNick()) {
			nickErrorText.style.opacity = 0;
			startGame('player');
		} else {
			nickErrorText.style.opacity = 1;
		}
	};

	var settingsMenu = document.getElementById('settingsButton');
	var settings = document.getElementById('settings');
	var instructions = document.getElementById('instructions');

	settingsMenu.onclick = function () {
		if (settings.style.maxHeight == '300px') {
			settings.style.maxHeight = '0px';
		} else {
			settings.style.maxHeight = '300px';
		}
	};

	playerNameInput.addEventListener('keypress', function (e) {
		var key = e.which || e.keyCode;

		if (key === KEY_ENTER) {
			if (validNick()) {
				nickErrorText.style.opacity = 0;
				startGame('player');
			} else {
				nickErrorText.style.opacity = 1;
			}
		}
	});
};

// Canvas.
var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;
var gameWidth = 0;
var gameHeight = 0;
var xoffset = -gameWidth;
var yoffset = -gameHeight;

var gameStart = false;
var disconnected = false;
var died = false;
var kicked = false;

// TODO: Break out into GameControls.
// var continuity = false;
var startPingTime = 0;
var toggleMassState = 0;
var backgroundColor = '#33cc33';
var lineColor = '#000000';

var foodConfig = {
	border: 0,
};

var playerConfig = {
	border: 6,
	textColor: '#FFFFFF',
	textBorder: '#000000',
	textBorderSize: 3,
	defaultSize: 30
};

var player = {
	id: -1,
	x: screenWidth / 2,
	y: screenHeight / 2,
	screenWidth: screenWidth,
	screenHeight: screenHeight,
	moveTarget: {x: screenWidth / 2, y: screenHeight / 2},
	attackTarget: {x: screenWidth / 2, y: screenHeight / 2}
};

var thisPlayer;

var users = [];
var mice = [];
var spiders = [];
var zombies = [];
var dragons = [];
var projectiles = [];
var xpLevels = [];
var achievements = [];

var leaderboard = [];
var moveTarget = {x: player.x, y: player.y};
var attackTarget = {x: player.x, y: player.y};
var directions = [];

var c = document.getElementById('cvs');
c.width = screenWidth; c.height = screenHeight;
c.addEventListener('mousemove', gameInput, false);
// c.addEventListener('mouseout', outOfBounds, false);
// c.addEventListener('keypress', keyInput, false);
c.addEventListener('keyup', directionUp, false);
c.addEventListener('keydown', directionDown, false);
c.addEventListener('touchstart', touchInput, false);
c.addEventListener('touchmove', touchInput, false);
c.addEventListener('mousedown', attack, false);
c.addEventListener('mouseup', stopAttack, false);

// Register when the mouse goes off the canvas.
// function outOfBounds() {
	// if (!continuity) {
		// target = { x : 0, y: 0 };
	// }
// }
function attack()
{
	socket.emit('attack');
}

function stopAttack()
{
	socket.emit('stopAttack');
}

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = toggleMass;

// var continuitySetting = document.getElementById('continuity');
// continuitySetting.onchange = toggleContinuity;

// var continuitySetting = document.getElementById('roundFood');
// continuitySetting.onchange = toggleRoundFood;

var graph = c.getContext('2d');

function ChatClient(config) {
	this.commands = {};
	var input = document.getElementById('chatInput');
	input.addEventListener('keypress', this.sendChat.bind(this));
	input.addEventListener('keyup', function(key) {
		input = document.getElementById('chatInput');

		key = key.which || key.keyCode;
		if (key === KEY_ESC) {
			input.value = '';
			c.focus();
		}
	});
}

// Chat box implementation for the users.
ChatClient.prototype.addChatLine = function (name, message, me) {
	if (mobile) {
		return;
	}
	var newline = document.createElement('li');

	// Colours the chat input correctly.
	newline.className = (me) ? 'me' : 'friend';
	newline.innerHTML = '<b>' + ((name.length < 1) ? 'An unnamed cell' : name) + '</b>: ' + message;

	this.appendMessage(newline);
};


// Chat box implementation for the system.
ChatClient.prototype.addSystemLine = function (message) {
	if (mobile) {
		return;
	}
	var newline = document.createElement('li');

	// Colours the chat input correctly.
	newline.className = 'system';
	newline.innerHTML = message;

	// Append messages to the logs.
	this.appendMessage(newline);
};

// Places the message DOM node into the chat box.
ChatClient.prototype.appendMessage = function (node) {
	if (mobile) {
		return;
	}
	var chatList = document.getElementById('chatList');
	if (chatList.childNodes.length > 10) {
		chatList.removeChild(chatList.childNodes[0]);
	}
	chatList.appendChild(node);
};

// Sends a message or executes a command on the click of enter.
ChatClient.prototype.sendChat = function (key) {
	var commands = this.commands,
		input = document.getElementById('chatInput');

	key = key.which || key.keyCode;

	if (key === KEY_ENTER) {
		var text = input.value.replace(/(<([^>]+)>)/ig,'');
		if (text !== '') {

			// Chat command.
			if (text.indexOf('-') === 0) {
				var args = text.substring(1).split(' ');
				if (commands[args[0]]) {
					commands[args[0]].callback(args.slice(1));
				} else {
					this.addSystemLine('Unrecognized Command: ' + text + ', type -help for more info.');
				}

			// Allows for regular messages to be sent to the server.
			} else {
				socket.emit('playerChat', { sender: player.name, message: text });
				this.addChatLine(player.name, text, true);
			}

			// Resets input.
			input.value = '';
			c.focus();
		}
	}
};

// Allows for addition of commands.
ChatClient.prototype.registerCommand = function (name, description, callback) {
	this.commands[name] = {
		description: description,
		callback: callback
	};
};

// Allows help to print the list of all the commands and their descriptions.
ChatClient.prototype.printHelp = function () {
	var commands = this.commands;
	for (var cmd in commands) {
		if (commands.hasOwnProperty(cmd)) {
			this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
		}
	}
};

var chat = new ChatClient();

// Chat command callback functions.
function keyInput(event) {
	var key = event.which || event.keyCode;
	if (key === KEY_SPACE) {
		socket.emit('space');
	}
	else if (key === KEY_ENTER) {
		document.getElementById('chatInput').focus();
	}
	else if (key === KEY_ESC)
	{

	}
}

function hideAll()
{
	document.getElementById('archer').style.visibility = 'hidden';
	document.getElementById('knight').style.visibility = 'hidden';
	document.getElementById('mage').style.visibility = 'hidden';
	document.getElementById('fire').style.visibility = 'hidden';
	document.getElementById('lightning').style.visibility = 'hidden';
}

$('#archer' ).click(function() {
		socket.emit('upgrade', 'archer');
		hideAll();
		c.focus();
});

$('#knight' ).click(function() {
		socket.emit('upgrade', 'knight');
		hideAll();
		c.focus();
});

$('#mage' ).click(function() {
		socket.emit('upgrade', 'mage');
		hideAll();
		c.focus();
});

$('#lightning' ).click(function() {
		socket.emit('skill', 'lightning');
		hideAll();
		c.focus();
});

$('#fire' ).click(function() {
		socket.emit('skill', 'fire');
		hideAll();
		c.focus();
});

// Function called when a key is pressed, will change direction if arrow key.
function directionDown(event) {
	var key = event.which || event.keyCode;

	// console.log(key);

	if (key === KEY_SPACE) {
		socket.emit('space');
	}
	else if (key === KEY_ENTER) {
		document.getElementById('chatInput').focus();
	} else if (directional(key)) {
		if (newDirection(key,directions, true)) {
			updateTarget(directions);
			// socket.emit('0', target);
		}
	}
}

// Function called when a key is lifted, will change direction if arrow key.
function directionUp(event)
{
	var key = event.which || event.keyCode;
	if (directional(key))
	{
		if (newDirection(key,directions, false))
		{
			updateTarget(directions);
			// if (directions.length === 0) directionLock = false;
			// socket.emit('0', moveTarget);
		}
	}
}

// Updates the direction array including information about the new direction.
function newDirection(direction, list, isAddition) {
	var result = false;
	var found = false;
	for (var i = 0, len = list.length; i < len; i++) {
		if (list[i] == direction) {
			found = true;
			if (!isAddition) {
				result = true;
				// Removes the direction.
				list.splice(i, 1);
			}
			break;
		}
	}
	// Adds the direction.
	if (isAddition && found === false) {
		result = true;
		list.push(direction);
	}

	return result;
}

// Updates the target according to the directions in the directions array.
function updateTarget(list) {
	moveTarget = { x : 0, y: 0 };
	var directionHorizontal = 0;
	var directionVertical = 0;
	for (var i = 0, len = list.length; i < len; i++) {
		if (directionHorizontal === 0) {
			if (list[i] === KEY_LEFT || list[i] === KEY_A) directionHorizontal -= 1;
			else if (list[i] == KEY_RIGHT || list[i] === KEY_D) directionHorizontal += 1;
		}
		if (directionVertical === 0) {
			if (list[i] === KEY_UP  || list[i] === KEY_W) directionVertical -= 1;
			else if (list[i] === KEY_DOWN  || list[i] === KEY_S) directionVertical += 1;
		}
	}
	moveTarget.x += directionHorizontal;
	moveTarget.y += directionVertical;
}

function directional(key) {
	return horizontal(key) || vertical(key);
}

function horizontal(key) {
	return key == KEY_LEFT || key == KEY_RIGHT || key == KEY_A || key == KEY_D;
}

function vertical(key) {
	return key == KEY_DOWN || key == KEY_UP || key == KEY_W || key == KEY_S;
}
function checkLatency() {
	// Ping.
	startPingTime = Date.now();
	socket.emit('ping');
}

function toggleDarkMode() {
	var LIGHT = '#f2fbff',
		DARK = '#181818';
	var LINELIGHT = '#000000',
		LINEDARK = '#ffffff';

	if (backgroundColor === LIGHT) {
		backgroundColor = DARK;
		lineColor = LINEDARK;
		chat.addSystemLine('Dark mode enabled.');
	} else {
		backgroundColor = LIGHT;
		lineColor = LINELIGHT;
		chat.addSystemLine('Dark mode disabled.');
	}
}

function toggleBorder() {
	if (!borderDraw) {
		borderDraw = true;
		chat.addSystemLine('Showing border.');
	} else {
		borderDraw = false;
		chat.addSystemLine('Hiding border.');
	}
}

function toggleMass() {
	if (toggleMassState === 0) {
		toggleMassState = 1;
		chat.addSystemLine('Viewing mass enabled.');
	} else {
		toggleMassState = 0;
		chat.addSystemLine('Viewing mass disabled.');
	}
}

chat.registerCommand('ping', 'Check your latency.', function () {
	checkLatency();
});

chat.registerCommand('dark', 'Toggle dark mode.', function () {
	toggleDarkMode();
});

chat.registerCommand('border', 'Toggle visibility of border.', function () {
	toggleBorder();
});

chat.registerCommand('mass', 'Toggle visibility of mass.', function () {
	toggleMass();
});

// chat.registerCommand('continuity', 'Toggle continuity.', function () {
//     toggleContinuity();
// });

chat.registerCommand('roundfood', 'Toggle food drawing.', function (args) {
	toggleRoundFood(args);
});

chat.registerCommand('help', 'Information about the chat commands.', function () {
	chat.printHelp();
});

chat.registerCommand('login', 'Login as an admin.', function (args) {
	socket.emit('pass', args);
});

chat.registerCommand('kick', 'Kick a player, for admins only.', function (args) {
	socket.emit('kick', args);
});


// socket stuff.
function setupSocket(socket)
{
	// Handle ping.
	socket.on('pong', function ()
	{
		var latency = Date.now() - startPingTime;
		// debug('Latency: ' + latency + 'ms');
		chat.addSystemLine('Ping: ' + latency + 'ms');
	});

	// Handle error.
	socket.on('connect_failed', function ()
	{
		socket.close();
		disconnected = true;
	});

	socket.on('disconnect', function ()
	{
		socket.close();
		disconnected = true;
	});

	// Handle connection.
	socket.on('welcome', function (playerSettings, settings)
	{
		player = playerSettings;

		if(playerType === 'spectator')
		{
			player.x = gameWidth/2;
			player.x = gameHeight/2;
		}

		console.log(gameWidth, gameHeight);

		player.name = playerName;
		player.screenWidth = screenWidth;
		player.screenHeight = screenHeight;
		player.moveTarget = moveTarget;
		xpLevels = settings.xpLevels;

		socket.emit('gotit', player);
		gameStart = true;
		debug('Game started at: ' + gameStart);
		chat.addSystemLine('Connected to the game!');
		chat.addSystemLine('Type <b>-help</b> for a list of commands.');
		if (mobile)
		{
			document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
		}
		c.focus();
	});

	socket.on('gameSetup', function(data)
	{
		gameWidth = data.gameWidth;
		gameHeight = data.gameHeight;

		if(playerType === 'spectator')
		{
			player.x = gameWidth/2;
			player.y = gameHeight/2;
		}

		resize();
	});

	socket.on('playerDied', function (data)
	{
		chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> was eaten.');
	});

	socket.on('playerDisconnect', function (data)
	{
		chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> disconnected.');
	});

	socket.on('playerJoin', function (data)
	{
		chat.addSystemLine('{GAME} - <b>' + (data.name.length < 1 ? 'An unnamed cell' : data.name) + '</b> joined.');
	});

	socket.on('leaderboard', function (data)
	{
		leaderboard = data.leaderboard;
		var status = '<span class="title">Leaderboard</span>';
		for (var i = 0; i < leaderboard.length; i++)
		{
			status += '<br />';
			if (leaderboard[i].id == player.id)
			{
				if(leaderboard[i].name.length !== 0)
					status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + ' (' + leaderboard[i].level+')</span>';
				else
					status += '<span class="me">' + (i + 1) + '. Unnamed Freak (' + leaderboard[i].level+')</span>';
			}
			else
			{
				if(leaderboard[i].name.length !== 0)
					status += (i + 1) + '. ' + leaderboard[i].name+ ' (' + leaderboard[i].level+')';
				else
					status += (i + 1) + '. An unnamed cell' + ' (' + leaderboard[i].level+')';
			}
		}
		//status += '<br />Players: ' + data.players;
		document.getElementById('status').innerHTML = status;
	});

	socket.on('serverMSG', function (data)
	 {
		chat.addSystemLine(data);
	});

	// Chat.
	socket.on('serverSendPlayerChat', function (data)
	{
		chat.addChatLine(data.sender, data.message, false);
	});

	// Handle movement.
	socket.on('serverTellPlayerMove', function (visible, playerData)
	{
		if(playerType == 'player')
		{
			player.x = playerData.x;
			player.y = playerData.y;
		}

		users = visible.players;
		mice = visible.mice;
		spiders = visible.spiders;
		zombies = visible.zombies;
		dragons = visible.dragons;
		projectiles = visible.projectiles;
		thisPlayer = playerData;
	});

	// Death.
	socket.on('RIP', function ()
	{
		gameStart = false;
		died = true;
		window.setTimeout(function()
		{
			document.getElementById('gameAreaWrapper').style.opacity = 0;
			document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
			died = false;
			if (animLoopHandle)
			{
				window.cancelAnimationFrame(animLoopHandle);
				animLoopHandle = undefined;
			}
		}, 1000);
	});

	socket.on('kick', function (data)
	{
		gameStart = false;
		reason = data;
		kicked = true;
		socket.close();
	});

	socket.on('LVL2', function ()
	{
		document.getElementById('archer').style.visibility = 'visible';
		document.getElementById('knight').style.visibility = 'visible';
		document.getElementById('mage').style.visibility = 'visible';
	});


	socket.on('LVL5', function (one, two)
	{
		document.getElementById(one).style.visibility = 'visible';
		document.getElementById(two).style.visibility = 'visible';
	});


	socket.on('achievement', function(achievement)
	{
		achievements.push(achievement);
	});
}

function drawCircle(centerX, centerY, radius, sides)
{
	var theta = 0;
	var x = 0;
	var y = 0;

	graph.beginPath();

	for (var i = 0; i < sides; i++)
	{
		theta = (i / sides) * 2 * Math.PI;
		x = centerX + radius * Math.sin(theta);
		y = centerY + radius * Math.cos(theta);
		graph.lineTo(x, y);
	}

	graph.closePath();
	graph.stroke();
	graph.fill();
}

function drawCreature(creature, image, debug)
{
	graph.save();

	graph.translate(creature.x - player.x + screenWidth / 2, creature.y - player.y + screenHeight / 2); // change origin

	var useImage;
	if(creature.dead)
	{
		useImage = skull.image;
	}
	else
	{
		useImage = image.image;

		if(debug)
		{
			graph.beginPath();
			graph.arc(0, 0, 50, 0, 2 * Math.PI);
			graph.stroke();
		}

		graph.fillStyle='red';
		graph.fillRect(-image.size/2, image.size/2 , image.size, 5);
		graph.fillStyle='green';
		graph.fillRect(-image.size/2, image.size/2 , creature.hp / creature.maxHP * image.size, 5);

		graph.rotate(creature.direction);
	}

	graph.drawImage(useImage, -image.size/2 , -image.size/2 ,image.size, image.size);
	graph.restore();
}

function drawProjectile(projectile, debug)
{
	graph.save();
	graph.translate(projectile.x - player.x + screenWidth / 2, projectile.y - player.y + screenHeight / 2); // change origin

	if(debug)
	{
		graph.beginPath();
		graph.arc(0, 0, projectile.radius, 0, 2 * Math.PI);
		graph.stroke();
	}

	graph.rotate(projectile.direction);
	// console.log(projectile);

	if(projectile.type === 'lightning')
	{
		graph.drawImage(projectile_types[projectile.type].image, 0, 0, 20, projectile.dist);
	}
	else
		graph.drawImage(projectile_types[projectile.type].image, -projectile.radius, -projectile.radius,projectile.radius*2, projectile.radius*2);
	graph.restore();
}

function drawTree(tree)
{
	// graph.strokeStyle = spider.stroke;
	// graph.fillStyle = spider.fill;
	// graph.lineWidth = spider.strokeWidth;
	// drawCircle(spider.x - player.x + screenWidth / 2, spider.y - player.y + screenHeight / 2, spider.radius, spiderSides);

	graph.drawImage(tree.image, tree.x - player.x + screenWidth / 2 , tree.y - player.y + screenHeight / 2 , tree.size, tree.size);

}

// function drawSpider(spiderToDraw)
// {
// 	graph.beginPath();
// 	graph.arc(spiderToDraw.x - player.x + screenWidth / 2, spiderToDraw.y - player.y + screenHeight / 2, spiderToDraw.radius, 0, 2 * Math.PI);
// 	graph.stroke();

// 	graph.save();
// 	graph.translate(spiderToDraw.x - player.x + screenWidth / 2, spiderToDraw.y - player.y + screenHeight / 2); // change origin
// 	graph.rotate(spiderToDraw.direction);
// 	graph.drawImage(spider.image, -spider.size/2 , -spider.size/2 ,spider.size, spider.size);
// 	graph.restore();
// }


function drawPlayers(users, debug)
{

	for(var user = 0; user < users.length; user++)
	{
		if(debug)
		{
			graph.beginPath();
			graph.arc(users[user].x - player.x + screenWidth / 2, users[user].y - player.y + screenHeight / 2, users[user].radius, 0, 2 * Math.PI);
			graph.stroke();
		}

		var useImage;
		if(users[user].dead)
		{
			useImage = skull.image;
		}
		else
		{
			var left = '';
			if(users[user].direction == 'left')
				left = '_left';
			var char = classes[users[user].class];
			if(users[user].attacking)
				useImage = char['attack_image' + left];
			else
				useImage = char['image' + left];

			graph.fillStyle='red';
			graph.fillRect(users[user].x - player.x + screenWidth / 2 - users[user].radius , users[user].y - player.y + screenHeight / 2 + users[user].radius , users[user].radius*2, 5);
			graph.fillStyle='green';
			graph.fillRect(users[user].x - player.x + screenWidth / 2 - users[user].radius , users[user].y - player.y + screenHeight / 2 + users[user].radius , users[user].hp/users[user].maxHP * users[user].radius*2, 5);
		}

		graph.drawImage(useImage, users[user].x - player.x + screenWidth / 2 - (users[user].radius), users[user].y - player.y + screenHeight / 2 - (users[user].radius)  , users[user].radius * 2, users[user].radius * 2);

		graph.fillStyle='black';
		graph.fillRect(0, screenHeight - 10, screenWidth, 10);
		graph.font = '15px Arial';
		var text = users[user].name + ' (' + users[user].level + ')';
		graph.fillText(text, users[user].x - player.x + screenWidth / 2 - text.length * 3 ,  users[user].y - player.y + screenHeight / 2 - users[user].radius - 5);
	}
}

function drawGrass()
{
	var i = 0;

	var times = 4;

	if(playerType === 'spectator')
	{
		times = 20;
	}

	var tempx = player.x || screenWidth / 2;
	var tempy = player.y || screenHeight / 2;


	for (var x = xoffset - tempx; x < screenWidth; x += screenHeight / times)
	{
	  var j = 0;
	  for (var y = yoffset - tempy ; y < screenHeight; y += screenHeight / times)
	  {
			if(((i + j) % 2) === 0)
				graph.drawImage(grass.image, x , y ,grass.size, grass.size);
			j++;
	  }
	  i++;
	}
}

function drawXPbar ()
{
	graph.fillStyle='black';
	graph.fillRect(0, screenHeight - 10, screenWidth, 10);

	graph.font = '30px Arial';
	graph.fillText('Level ' + thisPlayer.level, screenWidth / 2, screenHeight - 20);

	graph.fillStyle='blue';
	graph.fillRect(0, screenHeight - 10, screenWidth * thisPlayer.xp/xpLevels[thisPlayer.level] , 10);
}

function drawborder() {
	graph.lineWidth = 1;
	graph.strokeStyle = playerConfig.borderColor;

	// Left-vertical.
	if (player.x <= screenWidth/2) {
		graph.beginPath();
		graph.moveTo(screenWidth/2 - player.x, 0 ? player.y > screenHeight/2 : screenHeight/2 - player.y);
		graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
		graph.strokeStyle = lineColor;
		graph.stroke();
	}

	// Top-horizontal.
	if (player.y <= screenHeight/2) {
		graph.beginPath();
		graph.moveTo(0 ? player.x > screenWidth/2 : screenWidth/2 - player.x, screenHeight/2 - player.y);
		graph.lineTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
		graph.strokeStyle = lineColor;
		graph.stroke();
	}

	// Right-vertical.
	if (gameWidth - player.x <= screenWidth/2) {
		graph.beginPath();
		graph.moveTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
		graph.lineTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
		graph.strokeStyle = lineColor;
		graph.stroke();
	}

	// Bottom-horizontal.
	if (gameHeight - player.y <= screenHeight/2) {
		graph.beginPath();
		graph.moveTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
		graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
		graph.strokeStyle = lineColor;
		graph.stroke();
	}
}

function drawAchievements()
{
	graph.fillStyle='black';
	graph.font = '30px Arial';
	for (var i = 0; i < achievements.length; i++)
	{
		if(achievements[i].counter-- < 0)
		{
			achievements.splice(i, 1);
			i--;
		}
		else
		{
			graph.fillText(achievements[i].txt, (screenWidth / 2) - achievements[i].txt.length , (i + 1) * 25);
		}
	}
}


function gameInput(mouse) {
	// if (!directionLock) {
		attackTarget.x = mouse.clientX - screenWidth / 2;
		attackTarget.y = mouse.clientY - screenHeight / 2;
		// debug('attackTarget');
	// }
}

function touchInput(touch) {
	touch.preventDefault();
	touch.stopPropagation();
	// if (!directionLock) {
		attackTarget.x = touch.touches[0].clientX - screenWidth / 2;
		attackTarget.y = touch.touches[0].clientY - screenHeight / 2;
	// }
}

window.requestAnimFrame = (function() {
	return  window.requestAnimationFrame       ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame    ||
			window.msRequestAnimationFrame     ||
			function( callback ) {
				window.setTimeout(callback, 1000 / 60);
			};
})();

window.cancelAnimFrame = (function(handle) {
	return  window.cancelAnimationFrame     ||
			window.mozCancelAnimationFrame;
})();

function animloop() {
	animLoopHandle = window.requestAnimFrame(animloop);
	gameLoop();
}

function gameLoop() {
	if (died) {
		graph.fillStyle = '#333333';
		graph.fillRect(0, 0, screenWidth, screenHeight);

		graph.textAlign = 'center';
		graph.fillStyle = '#FFFFFF';
		graph.font = 'bold 30px sans-serif';
		graph.fillText('You died!', screenWidth / 2, screenHeight / 2);
	}
	else if (!disconnected) {
		if (gameStart) {
			graph.clearRect(0, 0, screenWidth, screenHeight);
			graph.fillStyle = backgroundColor;
			graph.fillRect(0, 0, screenWidth, screenHeight);

			drawGrass();
			mice.forEach(function(creature){drawCreature(creature, mouse);});
			spiders.forEach(function(creature){drawCreature(creature, spider);});
			zombies.forEach(function(creature){drawCreature(creature, zombie);});
			dragons.forEach(function(creature){drawCreature(creature, dragon);});
			projectiles.forEach(drawProjectile);

			drawAchievements();
			drawborder();

			users.sort(function(obj1,obj2) {
				return obj1.level - obj2.level;
			});

			drawPlayers(users);

			if(playerType === 'player')
			{
				socket.emit('0', attackTarget, moveTarget); // playerSendTarget 'Heartbeat'.
				drawXPbar();
			}

		} else {
			graph.fillStyle = '#333333';
			graph.fillRect(0, 0, screenWidth, screenHeight);

			graph.textAlign = 'center';
			graph.fillStyle = '#FFFFFF';
			graph.font = 'bold 30px sans-serif';
			graph.fillText('Game Over!', screenWidth / 2, screenHeight / 2);
		}
	} else {
		graph.fillStyle = '#333333';
		graph.fillRect(0, 0, screenWidth, screenHeight);

		graph.textAlign = 'center';
		graph.fillStyle = '#FFFFFF';
		graph.font = 'bold 30px sans-serif';
		if (kicked) {
			if (reason !== '') {
				graph.fillText('You were kicked for:', screenWidth / 2, screenHeight / 2 - 20);
				graph.fillText(reason, screenWidth / 2, screenHeight / 2 + 20);
			}
			else {
				graph.fillText('You were kicked!', screenWidth / 2, screenHeight / 2);
			}
		}
		else {
			  graph.fillText('Disconnected!', screenWidth / 2, screenHeight / 2);
		}
	}
}

window.addEventListener('resize', resize);

function resize() {
	player.screenWidth = c.width = screenWidth = playerType == 'player' ? window.innerWidth : gameWidth;
	player.screenHeight = c.height = screenHeight = playerType == 'player' ? window.innerHeight : gameHeight;
	if(socket)
		socket.emit('windowResized', { screenWidth: screenWidth, screenHeight: screenHeight });
}
