'use strict';
 var cashBox=angular.module('cashBox',['ngRoute','ngCookies']);

  cashBox.config(['$routeProvider',function($routeProvider){
    $routeProvider
      .when('/getShedule',{
          templateUrl:"../templates/shedule.html",
          controller:"getSheduleCtrl"
      })
      .when('/personalCabinet/:userId',{
          templateUrl:"../templates/personalCabinet.html",
          controller:"cabinetCtrl"
      })
      .when('/login',{
          templateUrl:"../templates/login.html",
          controller:"loginCtrl"
      })
      .when('/registration',{
          templateUrl:"../templates/registration.html",
          controller:"registrationCtrl"
      })
      .when('/logOut',{
        templateUrl:"../templates/personalCabinet.html",
        controller:"logOutCtrl"
      })
      .when('/wagons/:trainId/:from/:to/:date/:distance',{
        templateUrl:"../templates/wagons.html",
        controller:"wagonsCtrl"
      })
      .when('/profile/:userId',{
        templateUrl:"../templates/profile.html",
        controller:"profileCtrl"
      })
      .otherwise({
        redirectTo:'/getShedule'
      });
  }])

cashBox.controller('getSheduleCtrl', ['$scope','$http','$cookieStore',function($scope,$http,$cookieStore){
  $scope.changeStations=function(){
    var first=$scope.station.firstStation;
    $scope.station.firstStation=$scope.station.lastStation;
    $scope.station.lastStation=first;
  }
  $scope.$watch('station.firstStation',function(oldValue){
      $http.post('/checkStations',{'data':oldValue}).success(function(data,status,headers,config){
          var stations=[];
          for(var i=0;i<data.length;i++){
            stations.push(data[i].name)
          }
          $scope.firstStations=stations;
      });
  })

  $scope.$watch('station.lastStation',function(oldValue){
      $http.post('/checkStations',{'data':oldValue}).success(function(data,status,headers,config){
          var stations=[];
          for(var i=0;i<data.length;i++){
            stations.push(data[i].name)
          }
          $scope.lastStations=stations;
      });
  })

  $http.get('/maxAndMinDate').success(function(data,status){
    if(status==200){
      $scope.maxDateValue=data[0].maxDate;
      $scope.minDateValue=data[0].minDate;
    }
  });

  $scope.visibleTable=function(length){
    return length>0;    
  }
  $scope.gettingShedule=function(){
    $http.post('/getShedule',$scope.station).success(function(data,status,headers,config){
      if(status==200){
          delete $scope.error;
          var options = {
             year: 'numeric',
             month: 'long',
             day: 'numeric',
             weekday: 'long',
             timezone: 'UTC',
             hour: 'numeric',
             minute: 'numeric'
          };
          var trainShedule=[];
          for(var i=0;i<data.length;i++){
            var dateIn=getDateIn(data[i][0].dateOut+" "+data[i][0].timeOut,[data[i][1].timeInRoad.split(":")[0],data[i][1].timeInRoad.split(":")[1]],options);
            var dateOut=new Date(data[i][0].dateOut+" "+data[i][0].timeOut);
            dateOut.setHours(dateOut.getHours()+1);
            var train={
              "date":dateOut.toLocaleDateString().split(".").reverse().join("-"),
              "trainId":data[i][0].trainId,
              "number":data[i][0].number,
              "type":data[i][0].type,
              "road":data[i][3].firstStation +" - " + data[i][4].lastStation,
              "from":data[i][0].name,
              "to":data[i][1].name,
              "dateOut":dateOut.toLocaleString("ru",options),
              "dateIn":dateIn,
              "timeInRoad":data[i][1].timeInRoad.split(":")[0]+" ч. "+data[i][1].timeInRoad.split(":")[1]+" м."
            };
            var wagon=[];
            for(var j=0;j<data[i][2].length;j++){
              var places={};
              places["type"]=data[i][2][j].wagonType;
              places["count"]=data[i][2][j].placeCount;
              places["price"]=data[i][2][j].price;
              wagon.push(places);
            }
            train["places"]=wagon;
            train["distance"]=data[i][5];
            trainShedule.push(train);
          }
            $scope.data=trainShedule;
      }
    }).error(function(data,status){
        if(status==400)
          $scope.error=data.error;
          delete $scope.data;
      });
  }
}]);

cashBox.controller('ticketCtrl', ['$scope','$routeParams','$http', function($scope,$routeParams,$http){

  $http.post('/getTickets',$routeParams).success(function(data,status){
    if(status==200){
      delete $scope.error;
      $scope.tickets=data;
      return;
    }
  }).error(function(data,status){
    if(status==400){
      delete $scope.tickets;
      $scope.error=data.error;
    }
  });
  $scope.checkStatus=function(status){
    if (status=="canceled"){
      return false;
    }else{
      return true;
    }
  }
  $scope.checkDateError=function(dateOut){
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).valueOf();
    var ticketDate = new Date(dateOut).valueOf();
    return ticketDate<today;
  }
  $scope.cancelTicket=function(ticketId){
    var i=0;
    while($scope.tickets[i].ticketId!=ticketId && i<$scope.tickets.length){
      i++;
    }
    var canceledPlace={
      "ticketId":$scope.tickets[i].ticketId,
      "trainId":$scope.tickets[i].trainId,
      "dateId":$scope.tickets[i].dateId,
      "placeId":$scope.tickets[i].placeId,
      "wagonId":$scope.tickets[i].wagonId,
      "price":$scope.tickets[i].price,
      "userId":$scope.tickets[i].userId,
      "date":$scope.tickets[i].date
    }
    $http.post('/cancelTicket',canceledPlace).success(function(data,status){
      if(status==200){
        alert('билет успешно отменен');
        window.location.reload();
       }
    }).error(function(data,status){
      if(status==400){
        alert('возникла ошибка отмена билета');
      }
    });
  }
  $scope.visibleTable=function(length){
    return length>0;
  }
}]);

cashBox.controller('profileCtrl', ['$scope','$http','$routeParams','$cookieStore', function($scope,$http,$routeParams,$cookieStore){
    $http.get('/checkCookies').success(function(data,status){
      if(status==200){
        $http.post('/getUserById',$routeParams).success(function(userData,status){
            if($cookieStore.get('username')!=userData.username){
              window.location = "#/login";  
              return;
            }else{
              $scope.user=userData;
            }
        }).error(function(data,status){
          if(status==400){
            window.history.back();
          }
        });
      }
    }).error(function(data,status){
        if(status==400)
          window.location = "#/login";  
    });

    $scope.editUser=function(){
      if($scope.user!==undefined){
        $scope.error={};
        var flag=false;
        if($scope.user.username===undefined){
          flag=true;
          document.querySelector('[name="username"]').style.borderColor="red";
        }else{
          document.querySelector('[name="username"]').style.borderColor="#337ab7";
        }
        if($scope.user.username!==undefined){
          if($scope.user.username.length<4){
            flag=true;
            $scope.error.usernameLength="Минимальная длина логина : 4";
          }
        }
        if($scope.user.email===undefined){
          flag=true;
          document.querySelector('[name="email"]').style.borderColor="red";
        }else{
          document.querySelector('[name="email"]').style.borderColor="#337ab7";
        }

        if($scope.user.cash===undefined){
          flag=true;
          document.querySelector('[name="cash"]').style.borderColor="red";
        }else{
          document.querySelector('[name="cash"]').style.borderColor="#337ab7";
        }
        if($scope.user.newPassword!==undefined && $scope.user.oldPassword!==undefined && $scope.user.repeatNewPassword!=undefined)
        if($scope.user.newPassword!==undefined){
          if($scope.user.newPassword.length<8){
            flag=true;
            $scope.error.newPassword="Минимальная длина пароля: 8";
          }
          if($scope.user.repeatNewPassword!==undefined){
            if($scope.user.newPassword!==$scope.user.repeatNewPassword){
              flag=true;
              $scope.error.equalPasswords="Пароли не совпадают";
            }
          }
        }
        if(flag){
          return;
        }
      }
      $http.post('/editUser',$scope.user).success(function(data,status){
          if(status==200){
            delete $scope.error;
            $cookieStore.put('username',data.username);
            $cookieStore.put('password',data.password);
            window.alert('Ваши данные успешно обновлены');
            window.history.back();
          }
      }).error(function(data,status){
        if(status==400){
          $scope.servError={};
          switch(data.error){
            case "username":
              $scope.servError.nameError="Никнейм недоступен";
              break;
            case "email":
              $scope.servError.emailError="E-mail недоступен";
              break;
            case "cash":
              $scope.servError.cashError="Кэш должен быть больше нуля";
              break;
            case "oldPassword":
              $scope.servError.passwordError="Старый пароль не верен";
              break;
          }
        }
      });
    }
}]);

cashBox.controller('personalLoginCtrl', ['$scope','$http', function($scope,$http){
    $scope.checkMenu=function(){
      return $scope.visibleMenu;
    }
    $http.get('/checkCookies').success(function(data,status){
      if(status==200){
        $scope.userId=data.userId;
        $scope.visibleMenu=true;
      }
    }).error(function(data,status){
      if(status==400)
        $scope.visibleMenu=false;
      });
}]);

cashBox.controller('loginCtrl', ['$scope','$http','$cookieStore' ,function($scope,$http,$cookieStore){
  $scope.checkError=function(){
    return $scope.error
  }
  $http.get('/checkCookies').success(function(data,status){
      if(status==200){
        window.location='#/';
      }
  })
  $scope.checkUserData=function(){
      $http.post('/login',$scope.user).success(function(data,status){
          if(status==200){
            $cookieStore.put('username',data.username);
            $cookieStore.put('password',data.password);
            window.history.back();
          }
      }).error(function(data,status){
        if(status==400){
          $scope.error="Не удается войти.Пожалуйста, проверьте правильность написания логина и пароля.";
        }
      })
  }
}]);

cashBox.controller('logOutCtrl', ['$scope','$http','$cookieStore' ,function($scope,$http,$cookieStore){
  $cookieStore.remove('username');
  $cookieStore.remove('password');
  window.location='#/';
}])

cashBox.controller('registrationCtrl', ['$scope','$http', function($scope,$http){

  $scope.uniqueLogin=function(){
    $http.post('/checkUniqueLogin',{"login":$scope.user.login}).success(function(data,status){
      if(status==200){
        delete $scope.realTimeUniqueLoginCheck;
        if($scope.user!==undefined){
          if($scope.error!==undefined){
            delete $scope.error;
          }
        }
      }
    }).error(function(data,status){
        if(status==400){
            $scope.realTimeUniqueLoginCheck="Логин недоступен";
        }
    });
  }
  $scope.uniqueEmail=function(){
    $http.post('/checkUniqueEmail',{"email":$scope.user.email}).success(function(data,status){
      if(status==200){
        console.log('fkaodfkadofodka');
        delete $scope.realTimeUniqueEmailCheck;
      }
    }).error(function(data,status){
        if(status==400){
            $scope.realTimeUniqueEmailCheck="E-mail недоступен";
        }
    });
  }
  $http.get('/checkCookies').success(function(data,status){
    if(status==200){
      window.location='#/';
      return;
    }
  }).error(function(data,status){
    if(status==400){
      $scope.registrUser=function(){
        if($scope.user!==undefined){
          $scope.error={};
          if($scope.user.login!==undefined){
            if($scope.user.login.length<4){
              $scope.error.userLength="Минимальная длина логина : 4";
              return;
            }
          }else{
            $scope.error.userLength="Минимальная длина логина : 4";
            return;
          }

          if($scope.user.password!==undefined){
            if($scope.user.password.length<8){
              $scope.error.passwordLength="Минимальная длина пароля :8";
              return;
            }
          }

          if($scope.user.secPassword!==undefined){
            if($scope.user.secPassword!==$scope.user.password){
              $scope.error.passwordEqual="Пароли не совпадают";
              return;
            }
          }
        }else{
          return;
        }

        $http.post('/registration',$scope.user).success(function(data,status){
          if(status==200){
            alert('Регистрация прошла успешно');
            window.location="#/login";
          }
        }).error(function(data,status){
            if(status==400){
              console.log("registration error");
            }
          });
        };
    }
  });
}]);


cashBox.controller('wagonsCtrl', ['$scope','$routeParams','$http', function($scope,$routeParams,$http){
    $http.get('/checkCookies').success(function(data,status){
      if(status==200){
        $scope.userId=data.userId;
        $http.post('/wagons',$routeParams).success(function(data,status){
                $scope.wagons=data;
        }).error(function(data,status){
          if(status==400){
            window.history.back();
          }
        });
      } 
    }).error(function(data,status){
        if(status==400){
            window.location = "#/login";
        }
    });
    $scope.getPlaces=function(){
      var obj=$routeParams;
      obj.wagonNumber=$scope.user.wagon.number;
      $http.post('/places',obj).success(function(data,status){
        if(status==200)
          $scope.places=data;
      }).error(function(data,status){
        if(status==400)
          $scope.error.placeNum="В выбранном вагоне отсутсвуют места";
      });
    }
    $scope.addTicket=function(){
      console.log($scope.user);
      if($scope.user!==undefined){
        var flag=false;
        if($scope.user.firstName===undefined){
          flag=true;
          document.querySelector('[name="firstName"]').style.borderColor="red";
        }else{
          document.querySelector('[name="firstName"]').style.borderColor="green";
        }
        if($scope.user.secondName===undefined){
          flag=true;
          document.querySelector('[name="secondName"]').style.borderColor="red";
        }else{
          document.querySelector('[name="secondName"]').style.borderColor="green";
        }
        if($scope.user.lastName===undefined){
          flag=true;
          document.querySelector('[name="lastName"]').style.borderColor="red";
        }else{
          document.querySelector('[name="lastName"]').style.borderColor="green";
        }
        if($scope.user.passportNumber===undefined){
          flag=true;
          document.querySelector('[name="passportNumber"]').style.borderColor="red";
        }else{
          document.querySelector('[name="passportNumber"]').style.borderColor="green";
        }
        if(flag){
          return;
        }
      }else{
        return;
      }
      var obj=$routeParams;
      obj.userData=$scope.user;
      console.log(obj.userData);
      $http.post('/addTicket',obj).success(function(data,status){
        if(status==200){
          delete $scope.error;
          alert('Билет успешно куплен');
          window.location='#/';
        }
      }).error(function(data,status){
          if(status==400){
              $scope.error={};
              if(data.error==="cash"){
                $scope.error.cash="У вас недостаточно средств для покупки билета.";
              }
              console.log('error with ticket');
          }
      });
    }
}]);


cashBox.controller('cabinetCtrl', ['$scope','$http','$routeParams','$cookieStore', function($scope,$http,$routeParams,$cookieStore){
    $http.get('/checkCookies').success(function(data,status){
      if(status==200){
        $http.post('/getUserById',$routeParams).success(function(userData,status){
            if($cookieStore.get('username')!=userData.username){
              window.location = "#/login";  
              return;
            }else{
              $scope.user=userData;
            }
        }).error(function(data,status){
          if(status==400){
            window.history.back();
          }
        });
      }
    }).error(function(data,status){
      if(status==400)
        window.location = "#/login";  
    });
}]);




function getDateIn(dateOut,timeInRoad,options){
  var date=new Date(dateOut);
  date.setHours(date.getHours()+parseInt(timeInRoad[0])+1);
  date.setMinutes(date.getMinutes()+parseInt(timeInRoad[1]));
  return date.toLocaleString("ru",options); 
 }

