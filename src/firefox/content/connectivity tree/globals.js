var DNSserver = null; 
var Gateway = [];
var echoServer = "192.150.187.12";//"157.166.226.26";//"74.125.224.133";//"157.166.255.19";//"212.58.241.131";//"74.125.224.116";//
var domainName = null;
var standardName = "www.google.com";
var proxy = null;
var url = null;
var standardURL = "http://www.google.com/";

var viewOnlyProblems = false;

var count = 0;
var id = setInterval(function() {
	/* perform the operation for 60 secs */
	count++;
	if(count > 240)
		clearInterval(id);
	/* create event */
	var element = document.createElement("AboutFathomElement");
	element.setAttribute("html", document.getElementById("result").innerHTML);
	document.documentElement.appendChild(element);
	/* throw the event */
	var evt = document.createEvent("Events");
	evt.initEvent("UpdateHTML", true, false);
	element.dispatchEvent(evt);
	document.documentElement.removeChild(element);
}, 250);

// update the tables
var globalUpdate = function(field, info) {

	var testID = null, table = null;
	if(DebugTestID) {
		testID = DebugTestID;
		table = "debugConnection";
	} else if(NetErrorTestID) {
		testID = NetErrorTestID;
		table = "netError";
	}
	
	var value = JSON.stringify(info);
	window.fathom.util.updateTables(testID, table, field, value);
}
