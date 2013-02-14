/* -*- mode: javascript; js-indent-level: 2; js-expr-indent-offset: 2; -*-
 * ***** BEGIN LICENSE BLOCK *****
 *
 * Copyright (c) 2011-2012 International Computer Science Institute (ICSI).
 * All rights reserved.
 *
 * See LICENSE for license and terms of usage. 
 *
 * ***** END LICENSE BLOCK *****
 */
 
var EXPORTED_SYMBOLS = ["SysUtils"];

var callbackFn = function (o, fn) {
	if (o && o["error"]) {
		//fn(o["error"]);
	} else {
		var status = o.exitstatus;
		var out = o.stdout;
		var err = o.stderr;
		if (err) return;
		else {
			if(out && out["error"]) {
				//dump("Fathom: ERROR");
			} else
				fn(out);
		}
	}
	o = fn = null;
}

function interfaces() {
}

interfaces.prototype = {
  name : null,
  address : {
    ipv4 : null,
    ipv6 : null,
    broadcast : null,
    mask : null
  },
  mtu : null,
  mac : null,
  tx : null,
  rx : null
}

function Cell() {
}

Cell.prototype = {
  id : null,
  mac : null,
  essid : null,
  frequency : null,
  quality : null,
  signal : null,
  channel : null,
  bitrate : [],
  encryption : null,
  mode : null,
  lastBeacon : null
};

function Hop() {
}

Hop.prototype = {
  id : null,
  host : null,
  ip : null,
  rtt1 : null,
  rtt2 : null,
  rtt3 : null
}

var network = {
  
  traceroute : {
    target : null,
    hop : null		
  },
  
  ping : {
    domain : null,
    ip : null,
    stats : {
      packets : {
	sent : null,
	received : null,
	lost : null,
      },
      rtt : {
	min : null,
	max : null,
	avg : null,
	mdev : null
      }
    }
  },

  gateway : {
    host : null,
    ip : null,
    mac : null,
    interface : null
  },
  
  nameserver : {
    domain : null,
    list : null
  },
  
  proxy : {
    host : null,
    port : null,
    type : null,
    flags : null,
    next : null,
    failoverProxy : null,
    failoverTimeout : null
  },
  
  routingTable : {
    entry : {
      destination : null,
      gateway : null,
      mask : null,
      interface : null
    },
    defaultEntry : null
  },
  
  interface : null
};



var SysUtils = function(obj) {
  this.fathom = obj;
}

SysUtils.prototype = {

  fathom : null,

  traceroute : function(userFn, host) {
    this.fathom.system.doTraceroute(cbk, host);
    var tmpos = this.fathom.util.os();
    try{
    function parseTraceroute(info) {
      network.traceroute.target = host;
      network.traceroute.hop = [];
      
      if(tmpos == "Linux")
	var start = 1;
      else if(tmpos == "Darwin")
	start = 0;
      switch(tmpos) {
      case "Linux":
      case "Darwin":
	var lines = info.split("\n");
	for(var i = start; i < lines.length; i++) {
	  var str = lines[i].replace(/\s{2,}/g,' ').replace(/\sms/g,'');
	  if(str.trim() == "")
	    continue;
	  var ent = str.trim().split(' ');
	  var h = new Hop();
	  h.id = ent[0];
	  h.host = ent[1];
	  h.ip = ent[2] ? ent[2].replace(/\(|\)/gi,'') : ent[2]; //ent[2].replace(/\(|\)/gi,'');
	  /*h.rtt1 = ent[3];
	  h.rtt2 = ent[4];
	  h.rtt3 = ent[5];
	  network.traceroute.hop.push(h);*/
	  
	    /* join the rtts and look for ms */
		var tmprtt = "";
		for(var k = 3; k < ent.length; k++)
			tmprtt += ent[k] + " ";
		var tmprtt1 = ent[3], tmprtt2 = ent[4], tmprtt3 = ent[5];
		var rtts = tmprtt.split("ms");
	
		var len = rtts.length > 1 ? rtts[0].trim().split(" ") : [];
		h.rtt1 = (len.length > 0) ? len[len.length-1]: "*";//tmprtt1;
	
		len = rtts.length > 2 ? rtts[1].trim().split(" ") : [];
		h.rtt2 = (len.length > 0) ? len[len.length-1]: "*";//tmprtt2;
	
		len = rtts.length > 3 ? rtts[2].trim().split(" ") : [];
		h.rtt3 = (len.length > 0) ? len[len.length-1]: "*";//tmprtt3;
	
		network.traceroute.hop.push(h);
	}
	break;
      case "WINNT":
	var lines = info.trim().split("\n");
	for(var i = 3; i < lines.length - 2; i++) {
	  var str = lines[i].replace(/\s{2,}/g,' ').replace(/\sms/g,'');
	  if(str.trim() == "")
	    continue;
	  var ent = str.trim().split(' ');
	  var h = new Hop();
	  h.id = ent[0];
	  h.host = ent[4];
	  h.ip = ent[5].replace(/[|]/gi,'');
	  h.rtt1 = ent[1];
	  h.rtt2 = ent[2];
	  h.rtt3 = ent[3];
	  network.traceroute.hop.push(h);
	}
	break;
      default:
	break;
      }
      userFn(network.traceroute);
    }
      }catch(e){
  }

    function cbk(o) {
      callbackFn(o, parseTraceroute);
    }
  },
  
  ping : function(userFn, host, count) {
    //dump("\n INSIDE PING \n")
    this.fathom.system.doPing(cbk, host, count);
    var tmpos = this.fathom.util.os();
    function parsePing(info) {
      //dump("\n inside parse ping... \n");
      switch(tmpos) {
      case "Linux":
      case "Android":
      case "Darwin":
	var lines = info.trim().split("\n");
	for(var i = 0; i < lines.length; i++) {
	  var line = lines[i].trim().replace(/\s{2,}/g,' ');
	  if(i > 0 && i < lines.length - 2)
	    continue;
	  if(i == 0) {
	    var s = line.split(' ');
	    network.ping.domain = s[1];
	    network.ping.ip = s[2].replace(/\(|\)|:/gi,'');
	  } else if(i == lines.length - 2) {
	    var s = line.split(',');
	    var sent = s[0].trim().split(' ')[0];
	    var received = s[1].trim().split(' ')[0];
	    var lost = s[2].trim().split('%')[0];
	    network.ping.stats.packets.sent = sent;
	    network.ping.stats.packets.received = received;
	    network.ping.stats.packets.lost = lost;														
	  } else if(i == lines.length - 1) {
	    var s = line.split('=')[1].split('/');
	    var min = s[0].replace(/ms/, "");
	    var max = s[1].replace(/ms/, "");
	    var avg = s[2].replace(/ms/, "");
	    network.ping.stats.rtt.min = min;
	    network.ping.stats.rtt.max = max;
	    network.ping.stats.rtt.avg = avg;
	  }
	}
	break;
      case "WINNT":
	var lines = info.trim().split("\n");
	//dump(info);
	if(lines.length == 1) {
	  network.ping.domain = "";
	  network.ping.ip = "";
	  return;
	}
	//dump("\nlines length = " + lines.length + "\n")
	for(var i = 0; i < lines.length; i++) {
	  
	  var line = lines[i].trim().replace(/\s{2,}/g,' ');
	  //dump("\n" + i + " line = " + line + "\n");
	  if(i > 0 && i < lines.length - 4)
	    continue;
	  if(i == 0) {
	    var s = line.split(' ');
	    network.ping.domain = s[1];
	    network.ping.ip = (s[2].indexOf('[') == -1) ? s[1] : s[2].replace(/[|]|:/gi,'');
	  } else if(i == lines.length - 3) {
	    var s = line.split(',');
	    var sent = s[0].trim().split(' ')[3];
	    var received = s[1].trim().split(' ')[2];
	    var lost = s[2].trim().split('%')[0].split("(")[1];
	    network.ping.stats.packets.sent = sent;
	    network.ping.stats.packets.received = received;
	    network.ping.stats.packets.lost = lost;
	    //dump("\n---------\n" + network.ping.stats.packets + "\n\n")														
	  } else if(i == lines.length - 1) {
	    var s = line.split(',');
	    var min = s[0].split('=')[1].split('ms')[0].trim();
	    var max = s[1].split('=')[1].split('ms')[0].trim();
	    var avg = s[2].split('=')[1].split('ms')[0].trim();
	    var mdev = 0;
	    network.ping.stats.rtt.min = min;
	    network.ping.stats.rtt.max = max;
	    network.ping.stats.rtt.avg = avg;
	    network.ping.stats.rtt.mdev = mdev;
	  }
	}
	break;
      default:
	break;
      }
      //dump("\n----- done with ping ----\n");
      userFn(network.ping);
    }

    function cbk(o) {
      callbackFn(o, parsePing);
    }
  },
  
  nameserver : function(userFn) {
    //dump("\n in nameserver code");
    this.fathom.system.getNameservers(cbk);
    var tmpos = this.fathom.util.os();
    network.nameserver.list = [];

    function parseNameServerInfo(info) {
      
      switch(tmpos) {
      case "Android":
		var s = info.trim();
		network.nameserver.list.push(s);
		break;
      case "Linux":
      case "Darwin":
	var lines = info.trim().split("\n");
	for(var i = 0; i < lines.length; i++) {
	  var line = lines[i].trim().replace(/\s{2,}/g,' ');
	  if(line[0] == "#" || line == "")
	    continue;
	  var s = line.split(' ');
	  if(s[0] == "domain")
	    network.nameserver.domain = s[1];
	  else if(s[0] == "nameserver")
	    network.nameserver.list.push(s[1]);
	}
	break;
      case "WINNT":
	var blocks = info.trim().split("\n\n");
	for(var i = 0; i < blocks.length; i++) {
	  //dump("\n info = " + blocks[i]);
	  var lines = blocks[i].split("\n");
	  var flag = false;
	  for(var j = 0; j < lines.length; j++) {
	    //dump("\n lines = " + lines[j])
	    var y = new RegExp("IPv4 Address.*:\\s+(.+)\\s+");
	    var w = y.exec(lines[j]);
	    if(w) {
	      //dump("\n ipv4 = " + lines[j]);
	      flag = true;
	    }
	    if(flag) {
	      var z = new RegExp("DNS Servers.*:\\s+(.*)\\s+");
	      var kw = z.exec(lines[j]);
	      if(kw) {
		//dump("\n DNS = " + lines[j])
		network.nameserver.list.push(kw[1]);
		flag = false;
	      }
	    }
	  }
	}
	break;
      default:
	break;
      }
      userFn(network.nameserver);
    }

    function cbk(o) {
      callbackFn(o, parseNameServerInfo);
    }
  },

  proxyForURL : function(userFn, uri) {
    var proxyInfo = this.fathom.system.getProxyInfo(uri);
    if(proxyInfo) {
      network.proxy.host = proxyInfo.host;
      network.proxy.port = proxyInfo.port;
      network.proxy.type = proxyInfo.type;
      network.proxy.failoverTimeout = proxyInfo.failoverTimeout;
      network.proxy.flags = proxyInfo.flags;
      network.proxy.next = proxyInfo.next;
      network.proxy.failoverProxy = proxyInfo.failoverProxy;
    } else {
      network.proxy.host = null;
      network.proxy.port = null;
      network.proxy.type = null;
      network.proxy.failoverTimeout = null;
      network.proxy.flags = null;
      network.proxy.next = null;
      network.proxy.failoverProxy = null;
    }
    userFn(network.proxy);
  },

  routingInfo : function(userFn) {
    this.fathom.system.getRoutingTable(cbk);
    var tmpos = this.fathom.util.os();
    function parseRoutingTable(info) {

      // parse the routing info and populate the routing table entries
      var dest = network.routingTable.entry.destination = new Array();
      var gate = network.routingTable.entry.gateway = new Array();
      var mask = network.routingTable.entry.mask = new Array();
      var intf = network.routingTable.entry.interface = new Array();
      network.routingTable.defaultEntry = [];

      switch(tmpos) {
		case "Android":
			function ip4(val) {
				var addr = [];
				var tmp = (val & 0xFF);
				if(tmp < 0)
				   tmp = tmp & 0xFF + 1;
				var t = addr.push(tmp);
				tmp = (val & 0xFF00) >> 8;
				if(tmp < 0)
				   tmp = tmp & 0xFFFF + 1;
				t = addr.push(tmp);
				tmp = (val & 0xFF0000) >> 16;
				if(tmp < 0)
				   tmp = tmp & 0xFFFFFF + 1;
				t = addr.push(tmp);
				tmp = (val & 0xFF000000) >> 24;
				if(tmp < 0)
				   tmp = tmp & 0xFFFFFFFF + 1;
				t = addr.push(tmp);
				return addr.join(".");
			}
			var lines = info.trim().split('\n');
			for (var i = 1; i < lines.length; i++) {
				var str = lines[i].replace(/\s{2,}/g, ' ');
				var ent = str.trim().split('\t');
				dest.push(ip4(parseInt(ent[1], 16)));
				gate.push(ip4(parseInt(ent[2], 16)));
				mask.push(ip4(parseInt(ent[7], 16)));
				intf.push(ent[0]);
				if (ip4(parseInt(ent[1], 16)) == "0.0.0.0") {
					// optionally check for flags -- like UG
					network.routingTable.defaultEntry.push({
						"gateway": ip4(parseInt(ent[2], 16)),
						"interface": ent[0],
						"version": "IPv4"
					});
				}
			}
			break;      
      case "Linux":
	var lines = info.trim().split('\n');
	for(var i = 2; i < lines.length; i++) {
	  var str = lines[i].replace(/\s{2,}/g,' ');
	  var ent = str.trim().split(' ');
	  dest.push(ent[0]);
	  gate.push(ent[1]);
	  mask.push(ent[2]);
	  intf.push(ent[7]);
	  if(ent[0] == "0.0.0.0") {
	    // optionally check for flags -- like UG
	    network.routingTable.defaultEntry.push({"gateway" : ent[1], "interface" : ent[7], "version" : "IPv4"});
	  }
	}
	// TODO : fix for IPv6
	break;
      case "Darwin":
	var parts = info.trim().split("Internet");
	var ipv4 = parts[1].split("Expire")[1];
	var ipv6 = parts[2].split("Expire")[1];
	// push ipv4 entries into the table
	var lines = ipv4.trim().split('\n');
	for(var i = 0; i < lines.length; i++) {
	  var str = lines[i].replace(/\s{2,}/g,' ');
	  var ent = str.trim().split(' ');
	  dest.push(ent[0]);
	  gate.push(ent[1]);
	  intf.push(ent[5]);
	  if(ent[0] == "default") {
	    // optionally check for flags -- like UG
	    network.routingTable.defaultEntry.push({"gateway" : ent[1], "interface" : ent[5], "version" : "IPv4"});
	  }
	}
	// TODO : fix for IPv6
	break;
      case "WINNT":
	var lines = info.trim().split("Active Routes:")[1].split("Persistent Routes:")[0].trim().split('\n');
	for(var i = 1; i < lines.length - 1; i++) {
	  var str = lines[i].replace(/\s{2,}/g,' ');
	  var ent = str.trim().split(' ');
	  dest.push(ent[0]);
	  gate.push(ent[2]);
	  mask.push(ent[1]);
	  intf.push(ent[3]);
	  if(ent[0] == "0.0.0.0") {
	    // optionally check for flags -- like metric
	    network.routingTable.defaultEntry.push({"gateway" : ent[2], "interface" : ent[3], "version" : "IPv4"});
	  }
	}
	break;
      default:
	break;
      }
      userFn(network.routingTable);
    }

    function cbk(o) {
      callbackFn(o, parseRoutingTable);
    }
  },

  activeInterfaces : function(userFn) {
    // return list of active interfaces
    this.fathom.system.getActiveInterfaces(cbk);
    var tmpos = this.fathom.util.os();
    
    network.interface = [];

    function setInterfaceInfo(text, rex) {
      var intf = new interfaces();
      var w = rex.exec(text);
      if(w) {
	intf.name = w[1];
	intf.address.ipv4 = w[5];
	intf.address.broadcast = w[7];
	intf.address.mask = w[6];
	intf.address.ipv6 = w[4];
	intf.mtu = w[2];
	intf.mac = w[3];
	// TODO : tx, rx
	network.interface.push(intf);
      }
    }

	function cidrToNetmask(bits) {
		var netmask = "";
		for(var i = 0; i < 4; i++) {
			if(i)
			    netmask += ".";
			if (bits >= 8) {
			    netmask += Math.pow(2, 8)-1;
			    bits -= 8;
			} else {
			    netmask += 256 - Math.pow(2, (8 - bits));
			    bits = 0;
			}
		}
		return netmask;
	}

    function parseInterfaceInfo(info) {
      switch(tmpos) {
		case "Android":
			var inter = info.trim().replace(/\s{2,}/g, ' ').split("\n");
			for (var i = 0; i < inter.length; i++) {
				var w = inter[i].split(" ");
				if(w[1].trim() == "UP") {
					var intf = new interfaces();
					intf.name = w[0].trim();
					var temp_ip = w[2].trim().split("/");
					intf.address.ipv4 = temp_ip[0].trim();
					intf.address.mask = cidrToNetmask(parseInt(temp_ip[1].trim()));
					network.interface.push(intf);
				}
			}
			break;      
      case "Linux":
	var inter = info.trim().split("\n\n");
	for(var i = 0; i < inter.length; i++) {
	  var x = new RegExp("(.+)\\s+Link.+HWaddr\\s(.+)\\s+inet addr:(.+)\\s+Bcast:(.+)\\s+Mask:(.+)\\s+inet6 addr:\\s+(.+)\\s+Scope.+\\s+.+MTU:(.+)\\s+Metric.+\\s+.+\\s+.+\\s+.+\\s+RX bytes:(.+)TX bytes:(.+)\\s*");
	  var w = x.exec(inter[i]);
	  var intf = new interfaces();
	  if(w) {
		  	//dump("\nInter == " + w + "\n")
			intf.name = w[1].trim();
			intf.address = {};
			intf.address.ipv4 = w[3].trim();
			intf.address.broadcast = w[4].trim();
			intf.address.mask = w[5].trim();
			intf.address.ipv6 = w[6].trim();
			intf.mtu = w[7].trim();
			intf.mac = w[2].trim();
			intf.tx = w[9].trim();
			intf.rx = w[8].trim();
			network.interface.push(intf);
	  } else {
			var regexp = {
				'name': new RegExp("(\\w+):\\s+", "ig"),
				'ipv4': new RegExp("inet ([\\d\\.]+)\\s", "ig"),
				'broadcast': new RegExp("broadcast ([\\d\\.]+)\\s", "ig"),
				'mask': new RegExp("netmask ([\\d\\.]+)\\s", "ig"),
				'ipv6': new RegExp("inet6 ([\\d\\w:]+)\\s", "ig"),
				'mtu': new RegExp("mtu (\\d+)", "ig"),
				'mac': new RegExp("ether ([\\d\\w:]+)\\s", "ig"),
				'tx': new RegExp("TX .+ bytes (.+)"),
				'rx': new RegExp("RX .+ bytes (.+)"),
			}

			for(var j in regexp) {
				var ww = regexp[j].exec(inter[i]);
				if(ww && ww[1]) {
					switch(j) {
						case 'ipv4':
						case 'broadcast':
						case 'mask':
						case 'ipv6':
							intf.address[j] = ww[1];
							break;
						case 'name':
						case 'mtu':
						case 'mac':
						case 'tx':
						case 'rx':
							intf[j] = ww[1];
							break;
						default:
							break;
					}
				}
			}
			if(intf.mac)
				interface.push(intf);
		}
	}
	break;
      case "Darwin":
	var lines = info.trim().split("\n");
	var inter = "";
	var x = new RegExp(".+flags.+mtu.+");
	//var reg = new RegExp("(.+):.+mtu\\s(.+).+ether\\s(.+)\\sinet6\\s(.+)\\sprefixlen.+inet\\s(.+)\\snetmask\\s(.+)\\sbroadcast\\s(.+)\\smedia.+");
	var reg = new RegExp("(.+):.+mtu\\s(.+).+ether\\s(.+).+inet6\\s(.+)\\sprefixlen.+inet\\s(.+)\\snetmask\\s(.+)\\sbroadcast\\s(.+).+media.+");
	for(var i = 0; i < lines.length; i++) {
	  if(x.test(lines[i].trim())) {
	    if(inter != "")
	      setInterfaceInfo(inter.replace(/\s{2,}/g,' '), reg);
	    inter = lines[i];
	  } else {
	    inter += lines[i];
	    if(i == lines.length - 1)
	      setInterfaceInfo(inter.replace(/\s{2,}/g,' '), reg);
	  }
	}
	break;
      case "WINNT":
	var adapter = null;
	var text = info.trim().split("\n");
	for(var i = 0; i < text.length; i++) {
	  var intf = new interfaces();
	  if(text[i].indexOf("adapter") != -1) {
	    adapter = text[i].replace(/:/, "");
	  }
	  if(adapter) {
	    var y = new RegExp("IPv4 Address.*:\\s+(.+)\\s+");
	    var w = y.exec(text[i]);
	    if(w) {
	      intf.name = adapter.trim();
	      intf.address.ipv4 = w[1].trim().split("(")[0];
	      network.interface.push(intf);
	      adapter = null;
	    }	
	  }
	}
	break;
      default:
	break;
      }
      userFn(network.interface);
    }

    function cbk(o) {
      callbackFn(o, parseInterfaceInfo);
    }
  },

  dnsResolution : function(userFn, url) {
    // return list of ips, canonical record
    this.fathom.proto.dns.lookup(userFn, url);
  },

  CPUInfo : function(userFn) {
    
    var time = Date.now();
    var tmpos = this.fathom.util.os();
    if(tmpos == "WINNT") {
      var winSys = {};
      this.fathom.system.win.getCpuLoad(cbk);
      this.fathom.systen.win.getMemLoad(cbk);
      this.fathom.systen.win.getProcLoad(cbk);
    } else {
    	if (tmpos == "Android") {
			var androidSys = {};
			this.fathom.system.getMemInfo(cbk);
		}
      this.fathom.system.getLoad(cbk);
    }
    function parseTop(info) {
      var sys = {};
      switch(tmpos) {
		case "Android":
		var text = info.trim().split("\n\n");
		//var x = new RegExp("User (\d+)%, System (\d+)%, IOW.+User.+Idle (\d+)+ .+ = (\d+)");//.+Idle.+(\d+).+=.+(\d+)
		var x = new RegExp("User(.+)%.+System(.+)%.+IOW.+\\s+.+Idle(.+)IOW.+=(.+)");
		var w = x.exec(text[0].trim());
		if (w) {
			//sys.loadavg = new Array(w[1], w[2], w[3]);
			androidSys.tasks = {
				total: w[4].trim(),
				running: parseInt(w[4].trim()) - parseInt(w[3].split("+")[0].trim()),
				sleeping: w[3].split("+")[0].trim()
			};
			androidSys.cpu = {
				user: w[1].trim(),
				system: w[2].trim(),
				//idle : w[9].trim()
			};
		}
		var y = new RegExp("MemTotal:(.+)kB\\s+MemFree:(.+)kB\\s+Buffers");
		var w = y.exec(text[0].trim());
		if (w) {
			androidSys.memory = {
				//total : w[10].trim(),
				used: parseInt(w[1].trim()) - parseInt(w[2].trim()),
				free: w[2].trim()
			};
		}
		if (androidSys.cpu && androidSys.memory) {
			androidSys.time = time;
			userFn(androidSys);
		}
		return;
		break;
      case "Linux":
	var text = info.trim().replace(/\s{2,}/g,' ').split("\n\n");
	var x = new RegExp(".+average:(.+),(.+),(.+)\\s+Tasks:(.+)total,(.+)running,(.+)sleeping.+\\s+Cpu.+:(.+)%us,(.+)%sy,.+ni,(.+)%id.+\\s+Mem:(.+)total,(.+)used,(.+)free");
	var w = x.exec(text);
	if(w) {
	  //sys.loadavg = new Array(w[1], w[2], w[3]);
	  sys.tasks = {
	    total : w[4].trim(),
	    running : w[5].trim(),
	    sleeping : w[6].trim()
	  };
	  sys.cpu = {
	    user : w[7].trim(),
	    system : w[8].trim(),
	    //idle : w[9].trim()
	  };
	  sys.memory = {
	    //total : w[10].trim(),
	    used : w[11].trim().split("k")[0],
	    free : w[12].trim().split("k")[0]
	  };
	  sys.time = time;
	}
	break;
      case "Darwin":
	var text = info.trim().replace(/\s{2,}/g,' ').split("\n\n");
	var x = new RegExp("Processes:(.+)total,(.+)running,(.+)sleeping.+\\s+.+\\s+Load Avg:(.+),(.+),(.+)\\s+CPU usage:(.+)user,(.+)sys,(.+)idle\\s+SharedLibs.+\\s+MemRegions.+\\s+PhysMem:.+inactive,(.+)M used,(.+)M free.\\s+");
	var w = x.exec(text);
	if(w) {
	  //sys.loadavg = new Array(w[4], w[5], w[6]);
	  sys.tasks = {
	    total : w[1].trim(),
	    running : w[2].trim(),
	    sleeping : w[3].trim()
	  };
	  sys.cpu = {
	    user : w[7].trim().slice(0,-1),
	    system : w[8].trim().slice(0,-1),
	    //idle : w[9].trim()
	  };
	  sys.memory = {
	    //total : (parseInt(w[10].trim()) + parseInt(w[11].trim())) + "M",
	    used : w[10].trim(),
	    free : w[11].trim()
	  };
	  sys.time = time;
	}
	break;
      case "WINNT":
	dump("\n\n Collecting windows system information \n\n")
	dump("\n--------------\n")
	dump(info)
	dump("\n--------------\n")
	
	var cpux = new RegExp("LoadPercentage\\s+(.+)");
	var memoryx = new RegExp("Total Physical Memory:\\s+(.+) MB\\s+Available Physical Memory:\\s+(.+) MB\\s+Virtual Memory: Max Size");
	var processx = new RegExp("System.+\\s+System");

	var cpuw = cpux.exec(info);
	var memoryw = memoryx.exec(info);
	var processw = processx.exec(info);

	if(cpuw) {
	  winSys.cpu = {
	    user : cpuw[1].trim()
	  }
	  dump("\n cpu = winSys.cpu.user");
	} else if(memoryw) {
	  winSys.memory = {
	    used : 1024 * (parseInt(memoryw[1].trim().replace(/,/, '')) - parseInt(memoryw[2].trim().replace(/,/, ''))),
	    free : 1024 * memoryw[2].trim()
	  }
	  //dump("\n memory = " + winSys.memory.used);
	} else if(processw) {
	  winSys.tasks = {
	    total : info.trim().split("\n").length - 2
	  }
	  //dump("\n tasks = " + winSys.tasks.total);
	}
	
	if(winSys.tasks /*&& winSys.cpu*/ && winSys.memory) {
	  dump("\n retunring win system info \n");
	  // this is just a temp hack, till we are able to 
	  // get the actual CPU usage via .bat or vb scripts
	  if(!winSys.cpu)
	    winSys.cpu = {user : null};
	  userFn(winSys);
	}
	return;
	break;
      default:
	break;
      }
      userFn(sys);
    }

    function cbk(o) {
      callbackFn(o, parseTop);
    }
    
  },
  
  defaultInterfaces : function(userFn) {
    // could be more than one
    function handler(obj) {
      userFn(obj.defaultEntry);
    }
    
    this.routingInfo(handler);
  },
  
  currentThroughput : function(userFn) {
    // get the default interface and ip
    // read its /proc/net/dev entry for tx, rx bytes
    var dIface = null;
    var ipv = null;
    var ip = null;
    var self = this;
    var f = this.fathom;
    var tmpos = this.fathom.util.os();
    var tx = {
      bytes : 0,
      packets : 0,
      errs : 0,
      drops : 0
    };
    var rx = {
      bytes : 0,
      packets : 0,
      errs : 0,
      drops : 0
    };
    var time = null;
    
    function cbk(o) {
      callbackFn(o, parseProcNetDev);
    }
    
    function parseProcNetDev(info) {
      // parse proc info
      switch(tmpos) {
      case "Linux":
      case "Android":
	if(dIface) {
	  var x = new RegExp(dIface.trim() + ":(.+)\\s*");
	  var w = x.exec(info);
	  if(w) {
	    var elems = w[1].trim().replace(/\s{2,}/g,' ').split(" ");
	    // store the tx, rx info
	    rx.bytes = elems[0].trim();
	    rx.packets = elems[1].trim();
	    rx.errs = elems[2].trim();
	    rx.drops = elems[3].trim();
	    tx.bytes = elems[8].trim();
	    tx.packets = elems[9].trim();
	    tx.errs = elems[10].trim();
	    tx.drops = elems[11].trim();
	  }
	}
	break;
      case "Darwin":
	if(dIface) {
	  var x = new RegExp(dIface.trim() + "(.+)\\s*");
	  //dump("\nInterface = " + dIface + "\n");
	  //dump(info + "\n");
	  var w = x.exec(info);
	  if(w) {
	    //dump(w);
	    var elems = w[1].trim().replace(/\s{2,}/g,' ').split(" ");
	    //dump(elems);
	    // store the tx, rx info
	    rx.bytes = elems[5].trim();
	    rx.packets = elems[3].trim();
	    rx.errs = 0;
	    rx.drops = 0;
	    tx.bytes = elems[8].trim();
	    tx.packets = elems[6].trim();
	    tx.errs = 0;
	    tx.drops = 0;
	  }
	}
	break;
      case "WINNT":
	if(dIface) {
	  var x = new RegExp("Bytes\\s+(.+)\\s+(.+)\\s+Unicast packets\\s+(.+)\\s+(.+)\\s+Non-unicast packets\\s+(.+)\\s+(.+)\\s+Discards\\s+(.+)\\s+(.+)\\s+Errors\\s+(.+)\\s+(.+)\\s+");
	  var elems = x.exec(info);
	  if(elems) {
	    rx.bytes = elems[1].trim();
	    rx.packets = elems[3].trim();
	    rx.errs = 0;
	    rx.drops = 0;
	    tx.bytes = elems[2].trim();
	    tx.packets = elems[4].trim();
	    tx.errs = 0;
	    tx.drops = 0;
	  }
	}
	break;
      }
      //userFn(JSON.stringify({tx: tx, rx: rx, httpsend: 0, httprecv: 0, time: time, interface: dIface, ipversion: ipv, ip: ip}));
      var retval = {tx: tx, rx: rx, httpsend: 0, httprecv: 0, time: time, interface: dIface, ipversion: ipv, ip: ip};
      userFn(retval);
      self = f = null;
    }
    
    function handler(obj) {
      // we take the first entry
      try{
	dIface = obj.defaultEntry[0].interface;
	ipv = obj.defaultEntry[0].version;
      } catch(e) {
	//throw "parseProcNetDev :: " + e;
      }
      self.activeInterfaces(callbk);
    }

    function callbk(info) {
      try {
	if(info.length > 0) {
	  for(var i = 0; i < info.length; i++) {
	  	//dump("\n i == " + i + " :: " + info[i].name + " :: " + dIface + " :: " + JSON.stringify(info[i].address));
	    if(tmpos == "WINNT") {
	      //dump("\ndIface = " + dIface + "\n")
	      if(info[i].address.ipv4 == dIface) {
		dIface = info[i].name;
		ip = info[i].address.ipv4;
		break;
	      }
	    } else {
	      if(info[i].name == dIface) {
	      	ip = info[i].address.ipv4;
			break;
	      }
	    }
	  }
	}
      } catch(e) {
      }
      f.system.getIfaceStats(cbk);
      time = Date.now();
    }
    
    this.routingInfo(handler);
  },
  
  wifiInfo : function(userFn) {
    var tmpos = this.fathom.util.os();
    var wifi = {
      link : null,
      signal : null,
      noise : null,
      time : null
    };

    this.fathom.system.getWifiStats(cbk);
    wifi.time = Date.now();
    
    function parseProcNetWireless(info) {
      // parse the info
      switch(tmpos) {
      case "Linux":
      case "Android":
	var lines = info.trim().split("\n");
	// just 3 lines are printed on linux
	// less than 3 lines means no wifi adapter is present
	if(lines.length < 3)
	  return;
	var line = lines[lines.length - 1];
	var elems = line.trim().replace(/\s{2,}/g,' ').replace(/\./g,'').split(" ");
	wifi.link = elems[2];
	wifi.signal = elems[3];
	wifi.noise = elems[4];
	break;
      case "Darwin":
	var lines = info.trim().split("\n");
	for(var i = 0; i < lines.length; i++) {
	  var elems = lines[i].trim().replace(/\s{2,}/g,' ').split(":");
	  if(elems[0] == "agrCtlRSSI")
	    wifi.signal = elems[1];
	  if(elems[0] == "agrCtlNoise")
	    wifi.noise = elems[1];
	}
	break;
      case "WINNT":
	var x = new RegExp("Signal\\s+:\\s+(.+)%");
	var elems = x.exec(info.trim());
	if(elems)
	  wifi.link = elems[1];
	break;
      }
      userFn(wifi);
    }
    
    function cbk(o) {
      callbackFn(o, parseProcNetWireless);
    }
  }
};
