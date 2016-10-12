// create the module and name it userApp
angular.module('userApp')
  .controller('bodyController', function($scope, $rootScope, User) {
    var self = this;
    self.loggedin = User.loggedin;
    var isTabletOrMobile = (function() {
      var check = false;
      (function(a) {
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true
      })(navigator.userAgent || navigator.vendor || window.opera);
      return check;
    })();
    $scope.responsiveCSS = isTabletOrMobile ? 'css/styleIpad.css' : 'css/style.css';
    self.logout = function() {
      User.logout();
    }

  })
  .controller('tvController', function($scope, $rootScope, User, $window, socket, $timeout) {
    var self = this;
    $scope.users = [];
    // User.uploaderId ? self.screen = true : self.start = true;
    self.screen = true;
    $rootScope.$on('loggedin', function(event, args) {
      socket.emit('signup', 'Success');
      self.start = false;
      self.takephoto = true;
    });
    // $scope.uploaderId = null;
    socket.on('upload', function(userId) {
      User.uploaderId = userId;
      $timeout(function() {
        User.getImages();
      }, 3000);
    });

    socket.on('refresh', function(msg) {
      User.uploaderId = null;
      $window.location.reload();
    });

    socket.on('signupOnTV', function(msg) {
      self.start = false;
      self.takephoto = true;
    });

    $scope.generateLink = function(link) {
      var d = new Date().getTime();
      return link + '?breakcache=' + d;
    }
    self.init = function() {
      if (!User.uploaderId) User.getImages();
    }
    $rootScope.$on('listimages', function(event, args) {
      var divWidth = 978 * _.keys(args.images[0]).length;
      $('#top').width(divWidth);
      $('#middle').width(divWidth);
      $('#bottom').width(divWidth);
      _.each(args.images, function(img, ind) {
        var key;
        if (ind === 0) key = 'topUrls';
        if (ind === 1) key = 'middleUrls';
        if (ind === 2) key = 'bottomUrls';
        $scope[key] = img;
      });
      self.screen = true;
      self.takephoto = false;
      if (!User.uploaderId) {
        function repeat() {
          moveImage('left', 'top', function() {});
          moveImage('right', 'middle', function() {});
          moveImage('left', 'bottom', function() {
            if (!self.takephoto && !User.uploaderId) {
              var luckyNo = _.random(2),
                lukcyNoSecond = _.random(24),
                list = ['top', 'middle', 'bottom'];
              $scope.$applyAsync(function() {
                $scope['topUrls']["top24"] = $scope['topUrls']["top0"];
                $scope['middleUrls']["middle24"] = $scope['middleUrls']["middle0"];
                $scope['bottomUrls']["bottom24"] = $scope['bottomUrls']["bottom0"];
                $scope[list[luckyNo] + 'Urls'][list[luckyNo] + "0"] = $scope[list[luckyNo] + 'Urls'][list[luckyNo] + lukcyNoSecond]
              });
              repeat();
            }
          });
        }
        repeat();
      }

      if (User.uploaderId) socket.emit('uploadfinish', 'upload is done');

    }); // listimages

    function moveImage(direction, id, callback) {
      var box = $('#' + id),
        time = 9;
      if (id === "middle") time = 11;
      if (id === "bottom") time = 13;
      TweenLite
        .fromTo(box, time, {
          x: -box.width() + 978
        }, {
          x: 0,
          ease: Expo.easeOut,
          onComplete: function() {
            callback();
          }
        });
    }

    socket.on('playgame', function(result) {
      if (!result) {
        var luckyNo = _.random(2),
          list = ['top', 'middle', 'bottom'];
        $scope[list[luckyNo] + 'Urls'][list[luckyNo] + "0"] = $scope[list[luckyNo] + 'Urls'][list[luckyNo] + "24"]
        $scope.$applyAsync(function() {
          $scope[list[luckyNo] + 'Urls'][list[luckyNo] + "0"] = $scope[list[luckyNo] + 'Urls'][list[luckyNo] + "24"]
        });
      }
      moveImage('left', 'top', function() {

      });
      moveImage('right', 'middle', function() {

      });
      moveImage('left', 'bottom', function() {
        $timeout(function() {
          $scope.$applyAsync(function() {
            if (result) $scope.win = true;
            else $scope.lose = true;
            $scope.screen = false;
            socket.emit('playfinished', result);
          });
        }, 3000);
      });
    });
  })
  .controller('loseController', function($scope, $state, socket) {
    var self = this;
    self.reload = function() {
      socket.emit('reloadTV', 'reload');
      $state.transitionTo("home");
    }
  })
  .controller('winController', function($scope, $state, socket) {
    var self = this;
    self.reload = function() {
      socket.emit('reloadTV', 'reload');
      $state.transitionTo("home");
    }
  })
  .controller('ipadController', function($scope, $rootScope, User, $state, socket, ngToast) {
    var self = this;
    ngToast.dismiss();
    $scope.userplayed = false;
    socket.on('uploaddone', function() {
      if ($state.current.name !== 'goodluck') $state.transitionTo("spin");
    })
    self.user = {
      _id: User.user._id,
      email: User.user.email,
      firstname: User.user.firstname,
      lastname: User.user.lastname
    };
  })
  .controller('goodluckController', function($scope, User, socket) {
    socket.on('playresult', function(result) {
      result ? User.win() : User.lose();
    });
  })
  .controller('spinController', function($scope, User, socket, ngToast) {
    ngToast.dismiss();
    $scope.play = function() {
      var isWin = User.user.winnerIndex === 3 ? false : true;
      socket.emit('play', isWin);
      // socket.on('playresult', function(result) {
      //   result ? User.win() : User.lose();
      // });
      User.goodluck();
    }
  })
  .controller('registerController', function($scope, $rootScope, User, $timeout, ngToast) {
    var self = this;
    self.user = {
      firstname: null,
      lastname: null,
      email: null,
      date: null,
      postal: null,
      overage: false,
      permission: false,
      notselfexcluded: false,
      termsandconditions: false,
      subscription: false
    }

    $("#notice-link").fancybox();

    self.register = function() {
      // $('.notifications').remove();
      ngToast.dismiss();
      User.register(self.user);

    }
  });
