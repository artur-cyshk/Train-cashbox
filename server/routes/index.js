var express = require('express');
var crypto = require('crypto');
var connection=require('../config/DBConnection.js');
var validator = require('validator');
var router = express.Router();

router.get('/checkCookies',function(req,res,next){
	if(req.cookies.username===undefined){
		res.status(400).end();
	}else{
		var chiper=encrypt('aes-256-ofb',req.cookies.username,decrypt('aes192',req.cookies.username,req.cookies.password));
		var query='SELECT userId from traincashboxdb.user'+
				  ' where username="'+req.cookies.username.replace(/"/g,'') + '"' +
				  ' AND password="'+chiper+'"';
		connection.query(query,function(err,data){
			if(data.length>0){
				res.status(200).send(data[0]);
			}else{
				res.status(400).end();
			}
		});
	}
});

router.post('/checkStations',function(req,res,next){
	if(req.body.data){
	connection.query('SELECT name from `traincashboxdb`.station where name LIKE"'+req.body.data+'%" ORDER BY stationId',function(err,rows,fields){
		if(err) throw err;
		if(rows.length>0){
			res.status(200).send(rows);
		}else{
			res.end();
		}
	});
	}else{
		res.end();
	}
});

router.get('/maxAndMinDate',function(req,res,next){
	var query='SELECT MAX(DATE_FORMAT(Date, \'%Y-%m-%d\')) AS maxDate,MIN(DATE_FORMAT(Date, \'%Y-%m-%d\')) AS minDate from traincashboxdb.date';
	connection.query(query,function(err,data){
		if(err) throw err;
		if(data.length>0)
			res.status(200).send(data);
	});
});

router.post('/getShedule',function(req,res,next){
	var date=new Date(req.body.date);
	date.setHours(date.getHours()+1);
	date=date.toLocaleDateString();
	var dataset=[];
	getFirstStation();
	function getFirstStation(){
		var query='SELECT dateId,DATE_FORMAT(date.Date, \'%d-%M-%Y\') AS dateOut,DATE_FORMAT(train.timeOut,\'%H:%i\') AS timeOut,distance,trainId,number,type,stationId,name,DATE_FORMAT(timeInRoad, \'%H:%i\') AS timeInRoad,queue'+
				' FROM traincashboxdb.road'+
				' LEFT JOIN traincashboxdb.station using(stationId)'+
				' LEFT JOIN traincashboxdb.train using(trainId)'+
				' JOIN traincashboxdb.date_train using(trainId)'+
				' JOIN traincashboxdb.date using(dateId)'+
				' where station.name = "'+req.body.firstStation+'" AND date.Date like "'+date+'%" order by trainId; ';
		connection.query(query,onGetFirstStationReady);
	}
	function onGetFirstStationReady(err,data){
		console.log(data);
		if(data.length<=0){
			res.status(400).send({'error':'Поездов на выбранную дату или станцию отправления не существует'});
		}else{
			for(var i=0;i<data.length;i++){
				dataset[i]=[];
				dataset[i][0]=data[i];
			}
			getSecondStation();
		}
	}

	function getSecondStation(){
			var query='SELECT DATE_FORMAT(date.Date, \'%d-%M-%Y\') AS dateOut,DATE_FORMAT(train.timeOut,\'%H:%i\') AS timeOut,distance,trainId,number,type,stationId,name,DATE_FORMAT(timeInRoad, \'%H:%i\') AS timeInRoad,queue'+
			' FROM traincashboxdb.road'+
			' LEFT JOIN traincashboxdb.station using(stationId)'+
			' LEFT JOIN traincashboxdb.train using(trainId)'+
			' LEFT JOIN traincashboxdb.date_train using(trainId)'+
			' JOIN traincashboxdb.date using(dateId)'+
			' where date.Date like "'+date+'%" AND station.name="'+req.body.lastStation+'"'+
			' AND trainId IN (SELECT trainId FROM traincashboxdb.road'+
							' LEFT JOIN traincashboxdb.station using(stationId)'+
							' LEFT JOIN traincashboxdb.train using(trainId)'+
							' LEFT JOIN traincashboxdb.date_train using(trainId)'+
							' JOIN traincashboxdb.date using(dateId)'+
							' where station.name="'+req.body.firstStation+'" AND date.Date like "'+date+'%") order by trainId;'
			connection.query(query,onGetSecondStationReady);
	}

	function onGetSecondStationReady(err,data){
		if(data.length<=0){
			res.status(400).send({'error':'Поездов до выбранной станции не существует'});
		}else{
			for(var i=0;i<dataset.length;i++){
				for(var j=0;j<data.length;j++){
					if(dataset[i][0].trainId==data[j].trainId){
						dataset[i][1]=data[j];
					}
				}
			}
			for(var i=0;i<dataset.length;i++){
				if(dataset[i][1]!=null){
					if(dataset[i][0].queue>=dataset[i][1].queue){
						dataset.splice(i,1);
						i--;
					}
				}else{
					dataset.splice(i,1);
					i--;
				}
			}
			if(dataset.length>0){
				getWagonPlaceInfo();
			}else{
				res.status(400).send({'error':'Поездов до выбранной станции не существует'});
			}
		}
	}
	function getWagonPlaceInfo(){
		var trainsIds=getTrainsIds();
		var query='SELECT place_wagon.trainId,COUNT(placeId) AS "placeCount",wagon.type AS wagonType,percentPrice AS "price"  FROM traincashboxdb.place_wagon'+ 
				' JOIN traincashboxdb.date using(dateId)'+
				' LEFT JOIN traincashboxdb.wagon using(wagonId)'+
				' where place_wagon.trainId IN('+trainsIds+') AND date LIKE "'+date+'%" GROUP BY trainId ,wagon.type;';
		connection.query(query,onGetWagonPlaceInfoReady);
	}
	function onGetWagonPlaceInfoReady(err,data){
		if(data.length>0){
			for(var i=0;i<dataset.length;i++){
				dataset[i][2]=[];
				for(var j=0;j<data.length;j++){
					if(data[j].trainId==dataset[i][0].trainId){
						data[j].price=(data[j].price*(dataset[i][1].distance-dataset[i][0].distance))/100;
						dataset[i][2].push(data[j]);
					}
				}
				if(dataset[i][2].length<=0){
					dataset.splice(i,1);
					i--;
				}
			}
			if(dataset.length<=0){
				res.status(400).send({'error':'На все поезда на текущую дату билеты распроданы'});
			}else{
				getFirstAndLastStationsName();
			}
		}else{
			res.status(400).send({'error':'На все поезда на текущую дату билеты распроданы'});
		}
	}

	function getFirstAndLastStationsName(){
		var trainsIds=getTrainsIds();
		var query='CREATE TEMPORARY TABLE traincashboxdb.tmp('+
			'trainId INT(4) NOT NULL,maxQueue INT(4) NOT NULL,minQueue INT(4) NOT NULL);';
		connection.query(query,function(err){
			if (err){ 
				res.end();
			}else{
				var query='INSERT INTO traincashboxdb.tmp SELECT trainId,MAX(queue),'+
				' MIN(queue) from traincashboxdb.road'+
				' where trainId in('+trainsIds+')'+
				' group by trainId';
				connection.query(query,function(err){
					var query='select trainId,name from traincashboxdb.station'+
					' join traincashboxdb.road using(stationId)'+
					' join traincashboxdb.tmp using(trainId)'+
					' where road.trainId=tmp.trainId and road.queue=tmp.minQueue;';
					connection.query(query,function(err,minData){
						if(minData.length>0){
							for(var i=0;i<dataset.length;i++){
								for(var j=0;j<minData.length;j++){
									if(minData[j].trainId==dataset[i][0].trainId){
										dataset[i][3]={"firstStation":minData[j].name};
									}	
								}
							}
						}else{
							res.status(400).send('{error:Начальной станции не существует для выбранного поезда}');
						}
						var query='select trainId,name from traincashboxdb.station'+
						' join traincashboxdb.road using(stationId)'+
						' join traincashboxdb.tmp using(trainId)'+
						' where road.trainId=tmp.trainId and road.queue=tmp.maxQueue;';
						connection.query(query,onGetFirstAndLastStations);
					});
				})
			}
		})
	}

	function onGetFirstAndLastStations(err,maxData){
		if (err) throw err;
		if(maxData.length>0){
			for(var i=0;i<dataset.length;i++){
				for(var j=0;j<maxData.length;j++){
					if(maxData[j].trainId==dataset[i][0].trainId){
						dataset[i][4]={"lastStation":maxData[j].name};
					}
				}
			}
		}else{
			res.status(400).send('{error::Конечной станции не существует для выбранного поезда}')
		}
		tmpTableDestroy();
	}
	function tmpTableDestroy(){
		var query='DROP TABLE traincashboxdb.tmp';
		connection.query(query,finishDatasetResponse);
	}
	function finishDatasetResponse(){
		for(var i=0;i<dataset.length;i++){
			dataset[i][5]=dataset[i][1].distance-dataset[i][0].distance;
		}
		res.status(200).send(dataset);
	}
	function getTrainsIds(){
		var trainsIds="";
		for(var i=0;i<dataset.length;i++){
			trainsIds+=dataset[i][0].trainId+',';
		}
		trainsIds=trainsIds.substring(0,trainsIds.length-1);
		return trainsIds;
	}
});

router.post('/getTickets',function(req,res,next){
	if(req.body.userId){
		var query='SELECT ticketId,userId,dateId,trainId,placeId,wagonId,DATE_FORMAT(date.Date,\'%d-%M-%Y\') as date,train.number as trainNumber,train.type as trainType,place.number as placeNumber,'+
				' place.type as placeType,wagon.number as wagonNumber,'+
				' wagon.type as wagonType,firstStation,lastStation,price,passportData,Name as name,SecondName as secondName,LastName as lastName,Status as status'+
				' FROM traincashboxdb.tickets'+
				' JOIN traincashboxdb.date using(dateId)'+
				' JOIN traincashboxdb.train using(trainId)'+
				' JOIN traincashboxdb.place using(placeId)'+
				' JOIN traincashboxdb.wagon using(wagonId)'+
				' where userId="'+req.body.userId+'";';
		connection.query(query,function(err,data){
			if(err) throw err;
			if(data.length>0){
				res.status(200).send(data);
			}else{
				res.status(400).send({"error":"История покупок билетов пуста"});
			}
		});
	}
});

router.post('/cancelTicket',function(req,res,next){
	insertPlace();
	function insertPlace(){
		var query='INSERT into traincashboxdb.place_wagon (dateId,trainId,wagonId,placeId) VALUES'+
			' ("'+req.body.dateId+'","'+req.body.trainId+'","'+req.body.wagonId+'","'+req.body.placeId+'")';
		connection.query(query,onInsertPlaceReady);
	}

	function onInsertPlaceReady(err,data){
		if(err){
			res.status(400).end();
		}else{
			var query='UPDATE traincashboxdb.user set `cash`=`cash`+"'+req.body.price+'"'+
			' where userId="'+req.body.userId+'"';
			connection.query(query,onUpdateCashReady);
		}
	}
	function onUpdateCashReady(err,data){
		if(err){
			res.status(400).end();
		}else{
			var query='UPDATE traincashboxdb.tickets set `Status`="canceled"'+
			' where ticketId="'+req.body.ticketId+'"'; 
			connection.query(query,function(err,data){
				if(err){
					res.status(400).end();
				}else{
					res.status(200).end();
				}
			})
		}
	}
});

router.post('/editUser',function(req,res,next){
	if(req.body){
		checkUsername();
		function checkUsername(){
			console.log(req.body);
			var query='SELECT userId,username from traincashboxdb.user where username="'+req.body.username+'"';
			connection.query(query,onCheckUsernameReady);
		}
		function onCheckUsernameReady(err,usernameData){
			if(usernameData.length>0){
				if(usernameData[0].userId!=req.body.userId){
					res.status(400).send({"error":"username"});
					return;
				}
			}
			checkEmail();	
		}

		function checkEmail(){
			var query='SELECT userId,email from traincashboxdb.user where email="'+req.body.email+'"';
			connection.query(query,onCheckEmailReady);
		}
		function onCheckEmailReady(err,emailData){
			if(emailData.length>0){
				if(emailData[0].userId!=req.body.userId){
					res.status(400).send({"error":"email"});
					return;
				}
			}	
			checkCashAndGetOldUsername();
		}

		function checkCashAndGetOldUsername(){
			if(req.body.cash<0){
				res.status(400).send({"error":"cash"});
				return;
			}
			var query='SELECT username from traincashboxdb.user where userId="'+req.body.userId+'"';
			connection.query(query,onGetOldUsernameReady);
		}
		function onGetOldUsernameReady(err,usernameData){
			if(!err){
				if(req.body.newPassword && req.body.repeatNewPassword && req.body.oldPassword){
					if(req.body.newPassword!=req.body.repeatNewPassword){
						res.status(400).end();
						return;
					}
					if(req.body.newPassword.length<8){
						res.status(400).end();
						return;
					}
					var query='SELECT password from traincashboxdb.user where userId="'+req.body.userId+'" and password="'+encrypt('aes-256-ofb',usernameData[0].username,req.body.oldPassword)+'"';
					connection.query(query,function(err,data){
						if(data.length>0){
							updateUserInDBwithPass(data[0].password,usernameData[0].username);
						}else{
							res.status(400).send({"error":"oldPassword"});
							return;
						}
					})
				}else{
					updateUserInDBwithoutPass(usernameData[0].username);
				}
			}
		}
		function updateUserInDBwithoutPass(oldName){
			var query='SELECT password from traincashboxdb.user where userId="'+req.body.userId+'"';
			connection.query(query,function(err,oldPassData){
				var newPasswordCrypt=encrypt('aes-256-ofb',req.body.username,decrypt('aes-256-ofb',oldName,oldPassData[0].password));
				var query='UPDATE traincashboxdb.user set `username`="'+req.body.username+'",`password`="'+newPasswordCrypt+'",`email`="'+req.body.email+'",`cash`="'+req.body.cash+'"'+
						' where userId="'+req.body.userId+'"';
				connection.query(query,function(err,data){
					if(err) throw err;
					var newCookiePass=encrypt('aes192',req.body.username,decrypt('aes-256-ofb',req.body.username,newPasswordCrypt));
					res.status(200).send({'username':req.body.username,'password':newCookiePass});
				})
			})
		}
		function updateUserInDBwithPass(oldPasswordCrypt,oldName){
			var newPasswordCrypt=encrypt('aes-256-ofb',req.body.username,req.body.newPassword);
			var query='UPDATE traincashboxdb.user set `password`="'+newPasswordCrypt+'",`username`="'+req.body.username+'",`email`="'+req.body.email+'",`cash`="'+req.body.cash+'"'+
					' where userId="'+req.body.userId+'"';
			connection.query(query,function(err,data){
				if(err) throw err;
				var newCookiePass=encrypt('aes192',req.body.username,decrypt('aes-256-ofb',req.body.username,newPasswordCrypt));
				res.status(200).send({'username':req.body.username,'password':newCookiePass});
			})
		}
	}
});

router.post('/getUserById',function(req,res,next){
	var query='SELECT * from traincashboxdb.user where userId="'+req.body.userId+'"';
	connection.query(query,function(err,data){
		if(data.length>0){
			res.status(200).send(data[0]);
		}else{
			res.status(400).end();
		}
	});
});

router.post('/login',function(req,res,next){
	if(req.body && !validator.isNull(req.body.username) && !validator.isNull(req.body.password)){
	var query='SELECT * from traincashboxdb.user'+
			  ' where username="'+req.body.username+'"'+
			  ' AND password="'+encrypt('aes-256-ofb',req.body.username,req.body.password)+'"';
	}else{
		res.status(400).end();
	}
	connection.query(query,function(err,data){
		if(data){
			if(data.length>0){
				var resPassword=encrypt('aes192',data[0].username,decrypt('aes-256-ofb',data[0].username,data[0].password));
				res.send({'username':data[0].username,'password':resPassword});
			}else{
				res.status(400).end();
			}
		}else{
			res.status(400).end();
		}
	});
});

router.post('/checkUniqueLogin',function(req,res,next){
	console.log(req.body.login);
	var query='SELECT username from traincashboxdb.user where username="'+req.body.login+'"';
	connection.query(query,function(err,data){
		if(data.length>0){
			res.status(400).end();
		}else{
			res.status(200).end();
		}
	});
});

router.post('/checkUniqueEmail',function(req,res,next){
	var query='SELECT email from traincashboxdb.user where email="'+req.body.email+'"';
	connection.query(query,function(err,data){
		if(data.length>0){
			res.status(400).end();
		}else{
			res.status(200).end();
		}
	});
});	

router.post('/registration',function(req,res,next){
	checkFields();

	function checkFields(){
		if(!req.body.hasOwnProperty('login') || validator.isNull(req.body.login)){
			res.status(400).end();
			return;
		}
		if(req.body.login.length<4){
			res.status(400).end();
			return;
		}
		if(!req.body.hasOwnProperty('email') || validator.isNull(req.body.email)){
			res.status(400).end();
			return;
		}
		if(!validator.isEmail(req.body.email)){
			res.status(400).end();
			return;
		}
		if(!req.body.hasOwnProperty('password') || validator.isNull(req.body.password)){
			res.status(400).end();
			return;
		}
		if(!req.body.hasOwnProperty('secPassword') || validator.isNull(req.body.secPassword)){
			res.status(400).end();
			return;
		}
		if(req.body.secPassword!=req.body.password){
			res.status(400).end();
			return;
		}
		if(req.body.password.length<8){
			res.status(400).end();
			return;
		}
		registr();
	}

	function checkUniqueLogin(){
		var query='SELECT username from traincashboxdb.user where username="'+req.body.login+'"';
		connection.query(query,function(err,data){
			if(data.length>0){
				res.status(400).send({"error":"uniqueLogin"});
			}else{
				checkUniqueEmail();
			}
		});
	}
	function checkUniqueEmail(){
		var query='SELECT email from traincashboxdb.user where email="'+req.body.email+'"';
		connection.query(query,function(err,data){
			if(data.length>0){
				res.status(400).send({"error":"uniqueEmail"});
			}else{
				registr();
			}
		});
	}
	function registr(){
		var cipher=encrypt('aes-256-ofb',req.body.login,req.body.password);
		var query='INSERT INTO traincashboxdb.user (username,email,password,type,cash) VALUES ("'+req.body.login+'","'+req.body.email+'","'+cipher+'","user","0")';
		connection.query(query,function(err,data){
			if(err){
				res.status(400).end();
			}else{
				res.status(200).end();
			}
		});
	}
});

router.post('/wagons',function(req,res,next){
	var query='select wagon.number,wagon.type,wagon.percentPrice from traincashboxdb.wagon'+
				' join traincashboxdb.place_wagon using(wagonId)'+
				' join traincashboxdb.date using(dateId)'+
				' where trainId="'+req.body.trainId+'" and Date like "'+req.body.date+'%" group by wagon.number;';
	connection.query(query,function(err,data){
		if(data.length>0){
			for(var i=0;i<data.length;i++){
				data[i].percentPrice=(data[i].percentPrice*req.body.distance)/100;
			}
			res.status(200).send(data);
		}else{
			res.status(400).end();
		}
	})
});

router.post('/places',function(req,res,next){
	if(req.body.wagonNumber){
		var query='select place.number as placeNumber from traincashboxdb.place'+
					' join traincashboxdb.place_wagon using(placeId)'+
					' join traincashboxdb.wagon using (wagonId)'+
					' join traincashboxdb.date using(dateId)'+
					' where trainId="'+req.body.trainId+'" and wagon.number="'+req.body.wagonNumber+'" and date="'+req.body.date+'" order by place.number;';
		connection.query(query,function(err,data){
			if (data.length>0){
				res.status(200).send(data);
			}else{
				res.status(400).end();
			}
		});
	}
});

router.post('/addTicket',function(req,res,next){
	checkFields();
	var currentCash=0;

	function checkFields(){
		if(!req.body.hasOwnProperty('userData')){
			res.status(400).end();
			return;
		}
		if(!req.body.userData.hasOwnProperty('firstName') || validator.isNull(req.body.userData.firstName)){
			res.status(400).end();
			return;
		}
		if(!req.body.userData.hasOwnProperty('secondName') || validator.isNull(req.body.userData.secondName)){
			res.status(400).end();
			return;
		}
		if(!req.body.userData.hasOwnProperty('lastName') || validator.isNull(req.body.userData.lastName)){
			res.status(400).end();
			return;
		}
		console.log(req.body.userData);
		if(!req.body.userData.hasOwnProperty('passportNumber') || validator.isNull(req.body.userData.passportNumber)){
			res.status(400).end();
			return;
		}
		if(!req.body.userData.hasOwnProperty('wagon')){
			res.status(400).end();
			return;
		}
		if(!req.body.userData.hasOwnProperty('place')){
			res.status(400).end();
			return;
		}
		if(!req.body.userData.wagon.hasOwnProperty('percentPrice')){
			res.status(400).end();
			return;
		}
		checkCash();
	}

	function checkCash(){
		var query='SELECT cash from traincashboxdb.user where username='+req.cookies.username+'';
		connection.query(query,function(err,data){
			if(data.length>0){
				if(data[0].cash<req.body.userData.wagon.percentPrice){
					res.status(400).send({"error":"cash"});
					return;
				}
				currentCash=parseInt(data[0].cash);
				insertTicket();
			}else{
				req.status(400).end();
			}
		});
	}
	function insertTicket(){
		var query='INSERT INTO traincashboxdb.tickets (dateId,userId,trainId,firstStation,lastStation,'+
		'placeId,wagonId,price,passportData,Name,SecondName,LastName,Status)'+
		' SELECT'+
		' dateId,userId,"'+req.body.trainId+'","'+req.body.from+'","'+req.body.to+'",placeId,wagonId,"'+req.body.userData.wagon.percentPrice+'",'+
		'"'+req.body.userData.passportNumber+'","'+req.body.userData.firstName+'","'+req.body.userData.secondName+'","'+req.body.userData.lastName+'","bought"'+
		' from traincashboxdb.date,traincashboxdb.user,traincashboxdb.place,traincashboxdb.wagon'+
		' where date.Date="'+req.body.date+'" AND username='+req.cookies.username+' AND place.number="'+req.body.userData.place+'"'+
		' AND wagon.number="'+req.body.userData.wagon.number+'"';
		connection.query(query,onInsertTicketReady);
	}

	function onInsertTicketReady(err,data){
		if(err){
			throw err;
		}else{
			var query='DELETE traincashboxdb.place_wagon from traincashboxdb.place_wagon'+
					' inner join traincashboxdb.wagon using(wagonId)'+
					' join traincashboxdb.place using(placeId)'+
					' join traincashboxdb.date using(dateId)'+
					' where trainId="'+req.body.trainId+'" AND place.number="'+req.body.userData.place+'" AND '+
					' wagon.number="'+req.body.userData.wagon.number+'" AND date.Date="'+req.body.date+'"';
			connection.query(query,onDeletePlaceReady);
		}
	}

	function onDeletePlaceReady(err,data){
		if(err) throw err;
		var query='UPDATE traincashboxdb.user set `cash`="'+currentCash+'"-'+parseInt(req.body.userData.wagon.percentPrice)+'';
		connection.query(query,function(err,data){
			if(err){
				throw err;
			}else{
				res.status(200).end();
			}
		})
	}
});






router.get('/',function(req,res,next){
	res.sendfile('./public/index.html');
});

function encrypt(cipherType,text,password){
  	if(text.charAt(text.length-1)=='"' && text.charAt(0)=='"'){
		text=text.replace(/"/g,'');
	}
	if(password.charAt(password.length-1)=='"' && password.charAt(0)=='"'){
		password=password.replace(/"/g,'');
	}
	var cipher = crypto.createCipher(cipherType,text)
	var crypted = cipher.update(password,'utf8','hex')
	crypted += cipher.final('hex');
	return crypted;
}
 
function decrypt(cipherType,text,password){
  	if(text.charAt(text.length-1)=='"' && text.charAt(0)=='"'){
		text=text.replace(/"/g,'');
	}
	if(password.charAt(password.length-1)=='"' && password.charAt(0)=='"'){
		password=password.replace(/"/g,'');
	}
	var decipher = crypto.createDecipher(cipherType,text)
	var dec = decipher.update(password,'hex','utf8')
	dec += decipher.final('utf8');
	return dec;
}

module.exports = router; 