var express               = require("express"),
    mongoose              = require("mongoose"),
    passport              = require("passport"),
    bodyParser            = require("body-parser"),
    User                  = require("./models/user"),
    LocalStrategy         = require("passport-local"),
    passportLocalMongoose = require("passport-local-mongoose"),
    request               = require('request-promise'),
    cheerio               = require('cheerio'),
    nodemailer = require('nodemailer');

var app = express();


mongoose.connect("mongodb://localhost/dataxchain_user_registry");
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(require("express-session")({
    secret: "Rusty is the best and cutest dog in the world",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const dirID = '0x91EE34476990E59005caDa00dd66e08eF64E8a64';


//============
// ROUTES
//============

app.get("/", function(req, res){
    res.render("index", {loggedIn : req.isAuthenticated()});
});

app.get("/dataset/entry", isLoggedIn, function(req, res){
    res.render("dataset_entry", {loggedIn : req.isAuthenticated()});
});

app.post("/dataset/entry", async function(req, res){
    var data_info = req.body.data_name + "/%/" + req.body.descript + "/%/" + req.body.attributes+ "/%/" + req.body.dimension;
    var options = {
        method: 'POST',
        uri: 'https://dxdl.deepq.com:5000/entry/create/',
        form: {
        	directoryID: dirID,
        	userID: req.session['passport']['user'],
        	password: req.body.password,
        	offerPrice: req.body.price,
        	dueDate: req.body.dueDate,
        	dataCertificate: req.body.certificate,
        	dataOwner: req.body.owner,
        	dataDescription: data_info,
        	dataAccessPath: req.body.path
        },
        transform: function (body) {
            return cheerio.load(body);
        }
    };
    try{
    	var response = await request(options);
    	var json = JSON.parse(response.text());
    	console.log(json);
    }
    catch(err){
    	console.log(err);
    }
    res.redirect('/dataset/entry');
});

app.get("/dataset/request", isLoggedIn,function(req, res){
    res.render("dataset_request", {loggedIn : req.isAuthenticated()});
});

app.get("/dataset/search", isLoggedIn, async function(req, res){
    var datasets = []
    var dataset_infos = []
    var options = {
    	uri: 'https://dxdl.deepq.com:5000/entry/count',
        qs:{
        	directoryID: dirID
        },
        transform: function (body) {
            return cheerio.load(body);
        }
    };
    try{
    	var response = await request(options);
    	var json = JSON.parse(response.text());
    	var entryCount = json['result']['entryCount'];
    	//console.log(json);
    	options = {
            uri: 'https://dxdl.deepq.com:5000/entry/index',
            qs: {
            	directoryID: dirID,
            	index: 0
            },
            transform: function (body) {
                return cheerio.load(body);
            }
        };
    	for(var i = 0; i < entryCount; i++){
            options['qs']['index'] = i;
            response = await request(options);
            json = JSON.parse(response.text());
            var data_info = json['result']['dataDescription'].split("/%/");
            console.log(data_info);
            var dataset = {
              name: data_info[0],
              owner: json['result']['dataOwner'],
              price: json['result']['offerPrice'],
                url: json['result']['dataAccessPath']
            };
            datasets.push(dataset);
            dataset_infos.push(json['result']['dataDescription']);
	        //console.log(json);
        }
    }
    catch(err){
    	console.log(err);
    }
    
    //res.redirect('/dataset/search');
    res.render("search_dataset",  { datasets: datasets, data_info: dataset_infos, loggedIn : req.isAuthenticated()});
});


app.post("/dataset/search", async function(req, res){
    if(req.body.keywords == ""){
        res.redirect('/dataset/search');
    }
    else{
        var datasets = []
        var dataset_infos = []
        var options = {
        	uri: 'https://dxdl.deepq.com:5000/entry/count',
            qs:{
            	directoryID: dirID
            },
            transform: function (body) {
                return cheerio.load(body);
            }
        };
        try{
        	var response = await request(options);
        	var json = JSON.parse(response.text());
        	var entryCount = json['result']['entryCount'];
        	console.log(json);
        	options = {
                uri: 'https://dxdl.deepq.com:5000/entry/index',
                qs: {
                	directoryID: dirID,
                	index: 0
                },
                transform: function (body) {
                    return cheerio.load(body);
                }
            };
            var found = false;
        	for(var i = 0; i < entryCount; i++){
                options['qs']['index'] = i;
                response = await request(options);
                json = JSON.parse(response.text());
    	        if(json['result']['dataDescription'].includes(req.body.keywords)){
    	            var data_info = json['result']['dataDescription'].split("/%/");
    	            var dataset = {
                      name: data_info[0],
                      owner: json['result']['dataOwner'],
                      price: json['result']['offerPrice'],
                      url: json['result']['dataAccessPath']
                    };
                    datasets.push(dataset);
                    dataset_infos.push(json['result']['dataDescription']);
    	            console.log(json);
    	            found = true;
    	        }
            }
            if(!found){
                console.log('not found');
            }
        }
        catch(err){
        	console.log(err);
        }
        
        //res.redirect('/dataset/search');
        res.render("search_dataset",  { datasets: datasets, data_info: dataset_infos, loggedIn : req.isAuthenticated()});
    }
});

app.post("/dataset/info", isLoggedIn,async function(req, res){
    
    var data_info = req.body.data_info.split("/%/");
    var context = data_info[1];
    var attr = data_info[2].split(",");
    var dim = data_info[3];
    res.render("dataset_info", {context: context, attr: attr, dim: dim, loggedIn : req.isAuthenticated()});
});

app.post("/transaction", isLoggedIn,async function(req, res){
/////////////////////////////////////////////////////////// ///   

   var bitcore = require("bitcore-lib");
   var privateKey = new bitcore.PrivateKey('L1QLB3Xboou3X6PBaxXVy9ntzaJgH94HVF9NSm4M4ENzPvmz8tqg');
   var privateKeyWIF = 'cV4E8HKBsx22rvLxS8nzMBeW82LBpVKndphGvDbrd6f5trt37Pw8';
   var privateKey2 = bitcore.PrivateKey.fromWIF(privateKeyWIF);
   var address1 = privateKey2.toAddress();
   console.log('First Address: ');
   console.log(address1);
 
   var value = new Buffer('asfadgfadgsdgdsg');
   var hash = bitcore.crypto.Hash.sha256(value);
   var bn = bitcore.crypto.BN.fromBuffer(hash);
   var address2 = new bitcore.PrivateKey(bn,'testnet').toAddress();
   console.log('Second Address: ');
   
   
   console.log(address2);
   
   var utxo = {
  "txId" : "115e8f72f39fad874cfab0deed11a80f24f967a84079fb56ddf53ea02e308986",
  "outputIndex" : 0,
  "address" : address1,
  "script" : "76a91447862fe165e6121af80d5dde1ecb478ed170565b88ac",
  "satoshis" : 50000
};

var transaction = new bitcore.Transaction()
  .from(utxo)
  .to(address2, 15000)
  .sign(privateKey);
  
  console.log(transaction.toString());
///////////////////////////////////////////////////////////////////////   
    var buyer = req.session['passport']['user'];
    var seller = req.body.seller;
    var price = req.body.price;
   
    var url = req.body.url;
    res.render("transaction", {buyer: buyer, seller: seller, price: price, url: url, loggedIn : req.isAuthenticated()});

});

app.post("/confirmation", isLoggedIn,async function(req, res){
   //////////////////////////////////////////////////////////
var url = req.body.url;
var buyer_mail = req.body.email;

var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: '<EMAIL HERE>',
    pass: '<PASSWORD HERE>'
  }
});

var mailOptions = {
  from: '<EMAIL HERE>',
  to: buyer_mail,
  subject: 'Dataset Purchase',
  text: url
};

transporter.sendMail(mailOptions, function(error, info){
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});

 ///////////////////////////////////////////////////////////////////   
    var address = req.body.address;
    var WAValidator = require('wallet-address-validator');
    var valid = WAValidator.validate(address);
    if(valid){
       console.log('This is a valid address');
       res.render("confirmation", {loggedIn : req.isAuthenticated()});
    }
    else{
       console.log('Address INVALID');
       res.redirect("/dataset/search");
    }
});

// Auth Routes

//show sign up form
app.get("/register", function(req, res){
    res.render("register");
});

//handling user sign up
app.post("/register",async function(req, res){
    User.register(new User({username: req.body.username}), req.body.password, function(err, user){
        if(err){
            console.log(err);
            return res.render('register');
        }
        passport.authenticate("local")(req, res, function(){
           res.redirect("/");
        });
    });
    var username = req.body.username;
    var password = req.body.password;
    
    var options = {
		    method: 'POST',
		    uri: 'https://dxdl.deepq.com:5000/user/register/',
		    form: {
		    	directoryID: dirID,
		    	userType: 'provider',
		    	userID: username,
		    	password: password
		    },
		    transform: function (body) {
		        return cheerio.load(body);
		    }
	};
	
	var options2 = {
	    method: 'POST',
	    uri: 'https://dxdl.deepq.com:5000/user/register/',
	    form: {
	    	directoryID: dirID,
	    	userType: 'consumer',
	    	userID: username,
	    	password: password
	    },
	    transform: function (body) {
	        return cheerio.load(body);
	    }
	};
	try{
		var response = await request(options);
		var response2 = await request(options2);
		var json = JSON.parse(response.text());
		var json2 = JSON.parse(response2.text());
		console.log(json);
		console.log(json2);
		res.redirect('/login');
	}
	catch(err){
		console.log(err);
	}
});

// LOGIN ROUTES
//render login form
app.get("/login", function(req, res){
    res.render("login");
});

//login logic
//middleware

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login"
}), function(req, res){

});

app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}

app.listen(process.env.PORT, process.env.IP, function(){
   console.log("Server is listening!!!"); 
});