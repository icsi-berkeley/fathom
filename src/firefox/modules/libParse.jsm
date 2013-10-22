var EXPORTED_SYMBOLS = ["libParse", "gFathomObject"];

var gFathomObject = {
	obj: null
};

function interfaces() {}

interfaces.prototype = {
	name: null,
	address: {
		ipv4: null,
		ipv6: null,
		broadcast: null,
		mask: null,
		__exposedProps__: {
			ipv4: "r",
			ipv6: "r",
			broadcast: "r",
			mask: "r"
		}
	},
	mtu: null,
	mac: null,
	tx: null,
	rx: null,
	__exposedProps__: {
		name: "r",
		address: "r",
		mtu: "r",
		mac: "r",
		tx: "r",
		rx: "r"
	}
}

function Cell() {}

Cell.prototype = {
	id: null,
	mac: null,
	essid: null,
	frequency: null,
	quality: null,
	signal: null,
	channel: null,
	bitrate: [],
	encryption: null,
	mode: null,
	lastBeacon: null,
	__exposedProps__: {
		id: "r",
		mac: "r",
		essid: "r",
		frequency: "r",
		quality: "r",
		signal: "r",
		channel: "r",
		bitrate: "r",
		encryption: "r",
		mode: "r",
		lastBeacon: "r"
	}
};

function Hop() {}

Hop.prototype = {
	id: null,
	host: null,
	ip: null,
	rtt1: null,
	rtt2: null,
	rtt3: null,
	__exposedProps__: {
		id: "r",
		host: "r",
		ip: "r",
		rtt1: "r",
		rtt2: "r",
		rtt3: "r"
	}
}

function Gateway() {}

Gateway.prototype = {
	host: null,
	ip: null,
	mac: null,
	interface: null,
	__exposedProps__: {
		host: "r",
		ip: "r",
		mac: "r",
		interface: "r"
	}
}

var network = {

	traceroute: {
		target: null,
		hop: null,
		__exposedProps__: {
			target: "r",
			hop: "r"
		}
	},

	ping: {
		domain: null,
		ip: null,
		stats: {
			packets: {
				sent: null,
				received: null,
				lost: null,
				__exposedProps__: {
					sent: "r",
					received: "r",
					lost: "r"
				}
			},
			rtt: {
				min: null,
				max: null,
				avg: null,
				mdev: null,
				__exposedProps__: {
					min: "r",
					max: "r",
					avg: "r",
					mdev: "r"
				}
			},
			__exposedProps__: {
				packets: "r",
				rtt: "r"
			}
		},
		__exposedProps__: {
			domain: "r",
			ip: "r",
			stats: "r"
		}
	},

	nameserver: {
		domain: null,
		list: null,
		__exposedProps__: {
			domain: "r",
			list: "r"
		}
	},

	/*proxy: {
		host: null,
		port: null,
		type: null,
		flags: null,
		next: null,
		failoverProxy: null,
		failoverTimeout: null,
		__exposedProps__: {
			host: "r",
			port: "r",
			type: "r",
			flags: "r",
			next: "r",
			failoverProxy: "r",
			failoverTimeout: "r"
		}
	},*/

	routingTable: {
		entry: {
			destination: null,
			gateway: null,
			mask: null,
			interface: null,
			__exposedProps__: {
				destination: "r",
				gateway: "r",
				mask: "r",
				interface: "r"
			}
		},
		defaultEntry: [],
		__exposedProps__: {
			entry: "r",
			defaultEntry: "r"
		}
	},

	wireless : {
		cells : null,
		__exposedProps__: {
			cells: "r"
		}
	},

	interface: null
};

var libParse = function (output, obj) {

	var tmpos = output.os;
	var name = output.name;
	var params = output.params;

	if (obj && obj["error"]) {
		return obj["error"];
	} else {
		var status = obj.exitstatus;
		var out = obj.stdout;
		var err = obj.stderr;
		if (!out && err)
			return "Error: " + err;
		else {
			if(out && out["error"]) {
				return out["error"];
			}
		}
	}

	obj = out;	

	//var tmpos = window.fathom.util.os();

	switch (name) {
	case "traceroute":
		function parseTraceroute(info) {
			network.traceroute.target = params[0];
			network.traceroute.hop = [];

			if (tmpos == "Linux")
				var start = 1;
			else if (tmpos == "Darwin")
				start = 0;
			switch (tmpos) {
			case "Linux":
				var lines = info.split("\n");
				for (var i = start; i < lines.length; i++) {
					var str = lines[i].replace(/\s{2,}/g,' ');//.replace(/\sms/g,'');
					if (str.trim() == "") continue;
					var ent = str.trim().split(' ');
					var h = new Hop();
					h.id = ent[0];
					h.host = ent[1];
					h.ip = ent[2] ? ent[2].replace(/\(|\)/gi, '') : ent[2];

					/* join the rtts and look for ms */
					var tmprtt = "";
					for (var k = 3; k < ent.length; k++)
						tmprtt += ent[k] + " ";
					var tmprtt1 = ent[3],
					tmprtt2 = ent[4],
					tmprtt3 = ent[5];
					var rtts = tmprtt.split("ms");

					var len = rtts.length > 1 ? rtts[0].trim().split(" ") : [];
					h.rtt1 = (len.length > 0) ? len[len.length - 1] : "*";
					//tmprtt1;
					len = rtts.length > 2 ? rtts[1].trim().split(" ") : [];
					h.rtt2 = (len.length > 0) ? len[len.length - 1] : "*";
					//tmprtt2;
					len = rtts.length > 3 ? rtts[2].trim().split(" ") : [];
					h.rtt3 = (len.length > 0) ? len[len.length - 1] : "*";
					//tmprtt3;

					network.traceroute.hop.push(h);
				}
				break;
			case "Darwin":
				var lines = info.split("\n");
				for (var i = start; i < lines.length; i++) {
					var str = lines[i].replace(/\s{2,}/g,' ');//.replace(/\sms/g,'');
					if (str.trim() == "") continue;
					var ent = str.trim().split(' ');
					var h = new Hop();
					h.id = ent[0];
					h.host = ent[1];
					h.ip = ent[2] ? ent[2].replace(/\(|\)/gi, '') : ent[2];
						
					var tmprtt = "";
					for (var k = 3; k < ent.length; k++)
						tmprtt += ent[k] + " ";
					var tmprtt1 = ent[3],
					tmprtt2 = ent[4],
					tmprtt3 = ent[5];
					
					var flag = false;
					while(!flag) {
					    if(i == lines.length) {
					       flag = true;
					       continue;
					    }
						// test if the following lines are next hops
						var newline = (i < lines.length && lines[i+1]) ? lines[i+1].replace(/\s{2,}/g,' ').trim() : "";
						var elems = newline;
						var start = elems.split(" ")[0];
						// check if this is a hop number
						var par_t = parseInt(start);
						var par_e = par_t.toString().length;
						if(par_e == start.length && par_t != NaN) {
							// this is a hop, so continue forward
							flag = true;
						} else {
							i++;
							tmprtt += elems + " ";
						}
					}

					var rtts = tmprtt.split("ms");

					var len = rtts.length > 1 ? rtts[0].trim().split(" ") : [];
					h.rtt1 = (len.length > 0) ? len[len.length - 1] : "*";
					//tmprtt1;
					len = rtts.length > 2 ? rtts[1].trim().split(" ") : [];
					h.rtt2 = (len.length > 0) ? len[len.length - 1] : "*";
					//tmprtt2;
					len = rtts.length > 3 ? rtts[2].trim().split(" ") : [];
					h.rtt3 = (len.length > 0) ? len[len.length - 1] : "*";
					//tmprtt3;

					network.traceroute.hop.push(h);
				}
				break;
			case "WINNT":
				var lines = info.trim().split("\n");
				for (var i = 3; i < lines.length - 2; i++) {
					var str = lines[i].replace(/\s{2,}/g, ' ').replace(/\sms/g, '');
					if (str.trim() == "") continue;
					var ent = str.trim().split(' ');
					var h = new Hop();
					if(ent.length == 6) {
						h.id = ent[0];
						h.host = ent[4];
						h.ip = ent[5].replace(/\[|\]/gi, '');
						h.rtt1 = ent[1];
						h.rtt2 = ent[2];
						h.rtt3 = ent[3];
						network.traceroute.hop.push(h);
					} else if(ent.length == 5) {
						h.id = ent[0];
						h.ip = ent[4];
						h.rtt1 = ent[1];
						h.rtt2 = ent[2];
						h.rtt3 = ent[3];
						network.traceroute.hop.push(h);
					}
				}
				break;
			default:
				break;
			}
			return network.traceroute;
		}
		return parseTraceroute(obj);
		break;

	case "ping":
		function parsePing(info) {
		        //dump("\n inside parse ping... \n");
		    // Anna: build a local result object
		    // so we can run multiple parallel pings
		    var ping = 	{
			domain: null,
			ip: null,
			pings : [],
			stats: {
			    packets: {
				sent: null,
				received: null,
				lost: null,
				lossrate : 100,
				succrate : 0,
				__exposedProps__: {
				    sent: "r",
				    received: "r",
				    lost: "r",
				    lossrate : "r",
				    succrate : "r"
				}
			    },
			    rtt: {
				min: null,
				max: null,
				avg: null,
				mdev: null,
				__exposedProps__: {
				    min: "r",
				    max: "r",
				    avg: "r",
				    mdev: "r"
				}
			    },
			    __exposedProps__: {
				packets: "r",
				rtt: "r"
			    }
			},
			__exposedProps__: {
			    domain: "r",
			    ip: "r",
			    stats: "r",
			    pings: "r"
			}
		    };
			switch (tmpos) {
			case "Linux":
			case "Android":
			case "Darwin":
				var lines = info.trim().split("\n");
				for (var i = 0; i < lines.length; i++) {
					var line = lines[i].trim().replace(/\s{2,}/g, ' ');
					if (i > 0 && i < lines.length - 2) continue;
					if (i == 0) {
						var s = line.split(' ');
						ping.domain = s[1];
						ping.ip = s[2].replace(/\(|\)|:/gi, '');

					} else if (line.indexOf("bytes from")>0) {
					    var s = line.split(' ');

					    var p = {
						bytes : parseInt(s[0]),
						__exposedProps__: {
						    bytes : "r",
						}
					    };
					    [4,5,6].map(function(i) {
						if (s[i].indexOf('=')>0) {
						    var tmp = s[i].trim().split('=');
						    p[tmp[0]] = parseFloat(tmp[1]);
						    p.__exposedProps__[tmp[0]] = "r";
						}
					    });
					    res.pings.push(p);

					// Anna: this line count logic breaks 
					// with pings that fail
//					} else if (i == lines.length - 2) {
					} else if (line.indexOf("packet")>0) {
						var s = line.split(',');
						var sent = s[0].trim().split(' ')[0];
						var received = s[1].trim().split(' ')[0];
						var lost = s[2].trim().split('%')[0];
					    ping.stats.packets.sent = parseInt(sent);
					    ping.stats.packets.received = parseInt(received);
					    ping.stats.packets.lost = parseInt(lost);
					    ping.stats.packets.lossrate = 0.0;
					    ping.stats.packets.succrate = 100.0;
					    if (sent>0) {
						ping.stats.packets.lossrate = ping.stats.packets.lost*100.0/ping.stats.packets.sent;
						ping.stats.packets.succrate = ping.stats.packets.received*100.0/ping.stats.packets.sent;
					    }

					// Anna: this line count logic breaks 
					// with pings that fail as this 
					// this last line is empty and gets 
					// trimmed away I think
//					} else if (i == lines.length - 1) {
					} else if (line.indexOf("avg")>0) {
 					    var s = line.split('=')[1].split('/');
					    var min = s[0].replace(/ms/, "");
					    var max = s[1].replace(/ms/, "");
					    var avg = s[2].replace(/ms/, "");
					    var mdev = s[3].replace(/ms/, "");

					    ping.stats.rtt.min = parseFloat(min);
					    ping.stats.rtt.max = parseFloat(max);
					    ping.stats.rtt.avg = parseFloat(avg);
					    ping.stats.rtt.mdev = parseFloat(mdev);
					}
				}
				break;
			case "WINNT":
			    // Anna: TODO: check that this works if 
			    // there's no answer to the ping
				var lines = info.trim().split("\n");
				//dump(info);
				if (lines.length == 1) {
					ping.domain = "";
					ping.ip = "";
					return;
				}
				//dump("\nlines length = " + lines.length + "\n")
				for (var i = 0; i < lines.length; i++) {

					var line = lines[i].trim().replace(/\s{2,}/g, ' ');
					//dump("\n" + i + " line = " + line + "\n");
					if (i > 0 && i < lines.length - 4) continue;
					if (i == 0) {
						var s = line.split(' ');
						ping.domain = s[1];
						ping.ip = (s[2].indexOf('[') == -1) ? s[1] : s[2].replace(/[|]|:/gi, '');
					} else if (i == lines.length - 3) {
						var s = line.split(',');
						var sent = s[0].trim().split(' ')[3];
						var received = s[1].trim().split(' ')[2];
						var lost = s[2].trim().split('%')[0].split("(")[1];
						ping.stats.packets.sent = sent;
						ping.stats.packets.received = received;
						ping.stats.packets.lost = lost;
						//dump("\n---------\n" + network.ping.stats.packets + "\n\n")														
					} else if (i == lines.length - 1) {
						var s = line.split(',');
						var min = s[0].split('=')[1].split('ms')[0].trim();
						var max = s[1].split('=')[1].split('ms')[0].trim();
						var avg = s[2].split('=')[1].split('ms')[0].trim();
						var mdev = 0;
						ping.stats.rtt.min = min;
						ping.stats.rtt.max = max;
						ping.stats.rtt.avg = avg;
						ping.stats.rtt.mdev = mdev;
					}
				}
				break;
			default:
				break;
			}
			//dump("\n----- done with ping ----\n");
			return ping;
		}

		return parsePing(obj);
		break;

	case "nameserver":
		network.nameserver.list = [];

		function parseNameServerInfo(info) {

			switch (tmpos) {
			case "Android":
				var s = info.trim();
				network.nameserver.list.push(s);
				break;
			case "Linux":
			case "Darwin":
				var lines = info.trim().split("\n");
				for (var i = 0; i < lines.length; i++) {
					var line = lines[i].trim().replace(/\s{2,}/g, ' ');
					if (line[0] == "#" || line == "") continue;
					var s = line.split(' ');
					if (s[0] == "domain") network.nameserver.domain = s[1];
					else if (s[0] == "nameserver") network.nameserver.list.push(s[1]);
				}
				break;
			case "WINNT":
				var blocks = info.trim().split("\n\n");
				for (var i = 0; i < blocks.length; i++) {
					//dump("\n info = " + blocks[i]);
					var lines = blocks[i].split("\n");
					var flag = false;
					for (var j = 0; j < lines.length; j++) {
						//dump("\n lines = " + lines[j])
						var y = new RegExp("IPv4 Address.*:\\s+(.+)\\s+", "ig");
						var w = y.exec(lines[j]);
						if (w) {
							//dump("\n ipv4 = " + lines[j]);
							flag = true;
						}
						if (flag) {
							var z = new RegExp("DNS Servers.*:\\s+(.*)\\s+", "ig");
							var kw = z.exec(lines[j]);
							if (kw) {
								//dump("\n DNS = " + lines[j])
								network.nameserver.list.push(kw[1]);
								while(lines[j+1] && lines[j+1].trim().indexOf(":") == -1) {
									network.nameserver.list.push(lines[j+1].trim());
									j=j+1;
								}
								flag = false;
							}
						}
					}
				}
				break;
			default:
				break;
			}
			return network.nameserver;
		}

		return parseNameServerInfo(obj);
		break;

	/*case "proxyForURL":
		var proxyInfo = obj;
		if (proxyInfo) {
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
		return network.proxy;
		break;*/

	case "defaultInterfaces":
	case "routingInfo":
		function parseRoutingTable(info) {
		
	      	// parse the routing info and populate the routing table entries
			var dest = network.routingTable.entry.destination = new Array();
			var gate = network.routingTable.entry.gateway = new Array();
			var mask = network.routingTable.entry.mask = new Array();
			var intf = network.routingTable.entry.interface = new Array();
			network.routingTable.defaultEntry = new Array();

			switch (tmpos) {
			case "Android":

				function ip4(val) {
					var addr = [];
					var tmp = (val & 0xFF);
					if (tmp < 0) tmp = tmp & 0xFF + 1;
					var t = addr.push(tmp);
					tmp = (val & 0xFF00) >> 8;
					if (tmp < 0) tmp = tmp & 0xFFFF + 1;
					t = addr.push(tmp);
					tmp = (val & 0xFF0000) >> 16;
					if (tmp < 0) tmp = tmp & 0xFFFFFF + 1;
					t = addr.push(tmp);
					tmp = (val & 0xFF000000) >> 24;
					if (tmp < 0) tmp = tmp & 0xFFFFFFFF + 1;
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
							"version": "IPv4",
							"__exposedProps__": {
								gateway: "r",
								interface: "r",
								version: "r"
							}
						});
					}
				}
				break;
			case "Linux":
				var lines = info.trim().split('\n');
				for (var i = 2; i < lines.length; i++) {
					var str = lines[i].replace(/\s{2,}/g, ' ');
					var ent = str.trim().split(' ');
					dest.push(ent[0]);
					gate.push(ent[1]);
					mask.push(ent[2]);
					intf.push(ent[7]);
					if (ent[0] == "0.0.0.0") {
						// optionally check for flags -- like UG
						network.routingTable.defaultEntry.push({
							"gateway": ent[1],
							"interface": ent[7],
							"version": "IPv4",
							"__exposedProps__": {
								gateway: "r",
								interface: "r",
								version: "r"
							}
						});
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
				for (var i = 0; i < lines.length; i++) {
					var str = lines[i].replace(/\s{2,}/g, ' ');
					var ent = str.trim().split(' ');
					dest.push(ent[0]);
					gate.push(ent[1]);
					mask.push("N/A");
					intf.push(ent[5]);
					if (ent[0] == "default") {
						// optionally check for flags -- like UG
						network.routingTable.defaultEntry.push({
							"gateway": ent[1],
							"interface": ent[5],
							"version": "IPv4",
							"__exposedProps__": {
								gateway: "r",
								interface: "r",
								version: "r"
							}
						});
					}
				}
				// TODO : fix for IPv6
				break;
			case "WINNT":
				var lines = info.trim().split("Active Routes:")[1].split("Persistent Routes:")[0].trim().split('\n');
				for (var i = 1; i < lines.length - 1; i++) {
					var str = lines[i].replace(/\s{2,}/g, ' ');
					var ent = str.trim().split(' ');
					dest.push(ent[0]);
					gate.push(ent[2]);
					mask.push(ent[1]);
					intf.push(ent[3]);
					if (ent[0] == "0.0.0.0") {
						// optionally check for flags -- like metric
						network.routingTable.defaultEntry.push({
							"gateway": ent[2],
							"interface": ent[3],
							"version": "IPv4",
							"__exposedProps__": {
								gateway: "r",
								interface: "r",
								version: "r"
							}
						});
					}
				}
				break;
			default:
				break;
			}
			return network.routingTable;
		}
		var retval = parseRoutingTable(obj);
		if(name == "defaultInterfaces")
			return retval.defaultEntry;
		else
			return retval;
		break;

	case "activeInterfaces":
		network.interface = [];

		function setInterfaceInfo(text, rex) {
			var intf = new interfaces();
			intf.address = {
				ipv4: null,
				ipv6: null,
				broadcast: null,
				mask: null,
				__exposedProps__: {
					ipv4: "r",
					ipv6: "r",
					broadcast: "r",
					mask: "r"
				}
			};
			var w = rex.exec(text);
			if (w) {
				intf.name = w[1];
				intf.address.ipv4 = w[5];
				intf.address.broadcast = w[7];
				intf.address.mask = w[6];
				intf.address.ipv6 = w[4];
				intf.mtu = w[2];
				intf.mac = w[3];
				// TODO : tx, rx
				intf.tx = "N/A";
				intf.rx = "N/A";
				network.interface.push(intf);
			}
		}

		function cidrToNetmask(bits) {
			var netmask = "";
			for (var i = 0; i < 4; i++) {
				if (i) netmask += ".";
				if (bits >= 8) {
					netmask += Math.pow(2, 8) - 1;
					bits -= 8;
				} else {
					netmask += 256 - Math.pow(2, (8 - bits));
					bits = 0;
				}
			}
			return netmask;
		}

		function parseInterfaceInfo(info) {
			switch (tmpos) {
			case "Android":
				var inter = info.trim().replace(/\s{2,}/g, ' ').split("\n");
				for (var i = 0; i < inter.length; i++) {
					var w = inter[i].split(" ");
					if (w[1].trim() == "UP") {
						var intf = new interfaces();
						intf.name = w[0].trim();
						var temp_ip = w[2].trim().split("/");
						intf.address = {
							ipv4: null,
							ipv6: null,
							broadcast: null,
							mask: null,
							__exposedProps__: {
								ipv4: "r",
								ipv6: "r",
								broadcast: "r",
								mask: "r"
							}
						};
						intf.address.ipv4 = temp_ip[0].trim();
//						intf.address.mask = cidrToNetmask(parseInt(temp_ip[1].trim()));
//						intf.address.ipv4 = w[2].trim();
						intf.address.mask = w[3].trim();
						intf.address.ipv6 = "N/A";
						intf.address.broadcast = "N/A";
						network.interface.push(intf);
					}
				}
				break;
			case "Linux":
				var inter = info.trim().split("\n\n");
				for (var i = 0; i < inter.length; i++) {
					var x = new RegExp("(.+)\\s+Link.+HWaddr\\s(.+)\\s+inet addr:(.+)\\s+Bcast:(.+)\\s+Mask:(.+)\\s+inet6 addr:\\s+(.+)\\s+Scope.+\\s+.+MTU:(.+)\\s+Metric.+\\s+.+\\s+.+\\s+.+\\s+RX bytes:(.+)TX bytes:(.+)\\s*");
					var w = x.exec(inter[i]);
					var intf = new interfaces();
					intf.address = {
						ipv4: null,
						ipv6: null,
						broadcast: null,
						mask: null,
						__exposedProps__: {
							ipv4: "r",
							ipv6: "r",
							broadcast: "r",
							mask: "r"
						}
					};
					if (w) {
						//dump("\nInter == " + w + "\n")
						intf.name = w[1].trim();
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

						for (var j in regexp) {
							var ww = regexp[j].exec(inter[i]);
							if (ww && ww[1]) {
								switch (j) {
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
						if (intf.mac) network.interface.push(intf);
					}
				}
				break;
			case "Darwin":
				var lines = info.trim().split("\n");
				var inter = "";
				var x = new RegExp(".+flags.+mtu.+");
				//var reg = new RegExp("(.+):.+mtu\\s(.+).+ether\\s(.+)\\sinet6\\s(.+)\\sprefixlen.+inet\\s(.+)\\snetmask\\s(.+)\\sbroadcast\\s(.+)\\smedia.+");
				var reg = new RegExp("(.+):.+mtu\\s(.+).+ether\\s(.+).+inet6\\s(.+)\\sprefixlen.+inet\\s(.+)\\snetmask\\s(.+)\\sbroadcast\\s(.+).+media.+");
				for (var i = 0; i < lines.length; i++) {
					if (x.test(lines[i].trim())) {
						if (inter != "") setInterfaceInfo(inter.replace(/\s{2,}/g, ' '), reg);
						inter = lines[i];
					} else {
						inter += lines[i];
						if (i == lines.length - 1) setInterfaceInfo(inter.replace(/\s{2,}/g, ' '), reg);
					}
				}
				break;
			case "WINNT":
				/*var adapter = null;
				var text = info.trim().split("\n");
				for (var i = 0; i < text.length; i++) {
					var intf = new interfaces();
					intf.address = {
						ipv4: null,
						ipv6: null,
						broadcast: null,
						mask: null,
						__exposedProps__: {
							ipv4: "r",
							ipv6: "r",
							broadcast: "r",
							mask: "r"
						}
					};
					if (text[i].indexOf("adapter") != -1) {
						adapter = text[i].replace(/:/, "");
					}
					if (adapter) {
						var y = new RegExp("IPv4 Address.*:\\s+(.+)");
						var w = y.exec(text[i]);
						if (w) {
							intf.name = adapter.trim();
							intf.address.ipv4 = w[1].trim().split("(")[0];
							network.interface.push(intf);
							adapter = null;
						}
					}
				}*/
				var text = info.trim().split(":\r\n\r\n");
				for(var i = 1; i < text.length; i++) {
					var intf = new interfaces();
					intf.address = {
						ipv4: null,
						ipv6: null,
						broadcast: "N/A",
						mask: null,
						__exposedProps__: {
							ipv4: "r",
							ipv6: "r",
							broadcast: "r",
							mask: "r"
						}
					};
					var tmp = text[i-1].trim().split("\n");
					intf.name = tmp[tmp.length - 1];
					if (intf.name.indexOf("adapter") != -1) {
						var regexp = {
							'ipv4': new RegExp("IPv4 Address.*:\\s+(.+)", "ig"),
							'mask': new RegExp("Subnet Mask.*:\\s+(.+)", "ig"),
							'ipv6': new RegExp("IPv6 Address.*:\\s+(.+)", "ig"),
							'mtu': new RegExp("NA", "ig"),
							'mac': new RegExp("Physical Address.*:\\s+(.+)", "ig"),
							'tx': new RegExp("NA", "ig"),
							'rx': new RegExp("NA", "ig")
						}
		
						for (var j in regexp) {
							var ww = regexp[j].exec(text[i]);
							if (ww && ww[1]) {
								switch (j) {
								case 'ipv4':
								case 'ipv6':
									 intf.address[j] = ww[1].trim().split("(")[0];
									 break;
								case 'mask':
									intf.address[j] = ww[1];
									break;
								case 'mac':
									intf[j] = ww[1];
									break;
								default:
									break;
								}
							}
							intf.mtu = "N/A";
							intf.tx = "N/A";
							intf.rx = "N/A";
						}
					}
					if (intf.mac && intf.address.ipv4)
						network.interface.push(intf);
				}
				break;
			default:
				break;
			}
			return network.interface;
		}
		return parseInterfaceInfo(obj);
		break;

	case "memInfo":
		// TODO: Fix info for Darwin and WINNT
		var time = Date.now();

		function parseMemInfo(info) {
			switch (tmpos) {
				case "Android":
				case "Linux":
					var text = info.trim().split("\n\n");
					var y = new RegExp("MemTotal:(.+)kB\\s+MemFree:(.+)kB\\s+Buffers");
					var w = y.exec(text[0].trim());
					if (w) {
						var memory = {
							used: parseInt(w[1].trim()) - parseInt(w[2].trim()),
							free: w[2].trim(),
							__exposedProps__: {
								used: "r",
								free: "r"
							}
						};
					}
					return memory;
					break;
				case "Darwin":
					break;
				case "WINNT":
					break;
				default:
					break;
			}
		}
		return parseMemInfo(obj);
		break;

	case "loadInfo":
		// TODO: Fix info for Android and WINNT
		var time = Date.now();

		function parseTop(info) {
			switch (tmpos) {
			case "Android":
				var androidSys = {};
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
					return androidSys;
				}
				return;
				break;
			case "Linux":
				var sys = {};
				var text = info.trim().replace(/\s{2,}/g, ' ').split("\n\n");
				var x = new RegExp(".+average:(.+),(.+),(.+)\\s+Tasks:(.+)total,(.+)running,(.+)sleeping.+\\s+Cpu.+:(.+)%us,(.+)%sy,.+ni,(.+)%id.+\\s+Mem:(.+)total,(.+)used,(.+)free");
				var w = x.exec(text);
				if (w) {
					//sys.loadavg = new Array(w[1], w[2], w[3]);
					sys.tasks = {
						total: w[4].trim(),
						running: w[5].trim(),
						sleeping: w[6].trim(),
						__exposedProps__: {
							total: "r",
							running: "r",
							sleeping: "r"
						}
					};
					sys.cpu = {
						user: w[7].trim(),
						system: w[8].trim(),
						//idle : w[9].trim()
						__exposedProps__: {
							user: "r",
							system: "r"
						}
					};
					sys.memory = {
						//total : w[10].trim(),
						used: w[11].trim().split("k")[0],
						free: w[12].trim().split("k")[0],
						__exposedProps__: {
							used: "r",
							free: "r"
						}
					};
					sys.time = time;
					sys["__exposedProps__"] = {
						tasks: "r",
						cpu: "r",
						memory: "r",
						time: "r"
					};
				}
				return sys;
				break;
			case "Darwin":
				var sys = {};			
				var text = info.trim().replace(/\s{2,}/g, ' ').split("\n\n");
				var x = new RegExp("Processes:(.+)total,(.+)running,(.+)sleeping.+\\s+.+\\s+Load Avg:(.+),(.+),(.+)\\s+CPU usage:(.+)user,(.+)sys,(.+)idle\\s+SharedLibs.+\\s+MemRegions.+\\s+PhysMem:.+inactive,(.+)M used,(.+)M free.\\s+");
				var w = x.exec(text);
				if (w) {
					//sys.loadavg = new Array(w[4], w[5], w[6]);
					sys.tasks = {
						total: w[1].trim(),
						running: w[2].trim(),
						sleeping: w[3].trim(),
						__exposedProps__: {
							total: "r",
							running: "r",
							sleeping: "r"
						}
					};
					sys.cpu = {
						user: w[7].trim().slice(0, -1),
						system: w[8].trim().slice(0, -1),
						//idle : w[9].trim()
						__exposedProps__: {
							user: "r",
							system: "r"
						}
					};
					sys.memory = {
						//total : (parseInt(w[10].trim()) + parseInt(w[11].trim())) + "M",
						used: w[10].trim(),
						free: w[11].trim(),
						__exposedProps__: {
							used: "r",
							free: "r"
						}
					};
					sys.time = time;
					sys["__exposedProps__"] = {
						tasks: "r",
						cpu: "r",
						memory: "r",
						time: "r"
					};
				}
				return sys;
				break;
			case "WINNT":
				var winSys = {};
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

				if (cpuw) {
					winSys.cpu = {
						user: cpuw[1].trim()
					}
					dump("\n cpu = winSys.cpu.user");
				} else if (memoryw) {
					winSys.memory = {
						used: 1024 * (parseInt(memoryw[1].trim().replace(/,/, '')) - parseInt(memoryw[2].trim().replace(/,/, ''))),
						free: 1024 * memoryw[2].trim()
					}
					//dump("\n memory = " + winSys.memory.used);
				} else if (processw) {
					winSys.tasks = {
						total: info.trim().split("\n").length - 2
					}
					//dump("\n tasks = " + winSys.tasks.total);
				}

				if (winSys.tasks
				/*&& winSys.cpu*/
				&& winSys.memory) {
					dump("\n retunring win system info \n");
					// this is just a temp hack, till we are able to 
					// get the actual CPU usage via .bat or vb scripts
					if (!winSys.cpu) winSys.cpu = {
						user: null
					};
					return winSys;
				}
				return;
				break;
			default:
				break;
			}
		}

		return parseTop(obj);
		break;

	case "interfaceStats":
		var dIface = params[0];
		/*var ipv = params[1];
		var ip = params[2];*/
		var tx = {
			bytes: 0,
			packets: 0,
			errs: 0,
			drops: 0,
			__exposedProps__: {
				bytes: "r",
				packets: "r",
				errs: "r",
				drops: "r"
			}
		};
		var rx = {
			bytes: 0,
			packets: 0,
			errs: 0,
			drops: 0,
			__exposedProps__: {
				bytes: "r",
				packets: "r",
				errs: "r",
				drops: "r"
			}
		};
		var time = Date.now();

		function parseProcNetDev(info) {
			// parse proc info
			switch (tmpos) {
			case "Linux":
			case "Android":
				if (dIface) {
					var x = new RegExp(dIface.trim() + ":(.+)\\s*");
					var w = x.exec(info);
					if (w) {
						var elems = w[1].trim().replace(/\s{2,}/g, ' ').split(" ");
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
				if (dIface) {
					var x = new RegExp(dIface.trim() + "(.+)\\s*");
					//dump("\nInterface = " + dIface + "\n");
					//dump(info + "\n");
					var w = x.exec(info);
					if (w) {
						//dump(w);
						var elems = w[1].trim().replace(/\s{2,}/g, ' ').split(" ");
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
				if (dIface) {
					var x = new RegExp("Bytes\\s+(.+)\\s+(.+)\\s+Unicast packets\\s+(.+)\\s+(.+)\\s+Non-unicast packets\\s+(.+)\\s+(.+)\\s+Discards\\s+(.+)\\s+(.+)\\s+Errors\\s+(.+)\\s+(.+)\\s+");
					var elems = x.exec(info);
					if (elems) {
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
			var retval = {
				tx: tx,
				rx: rx,
				/*httpsend: 0,
				httprecv: 0,*/
				time: time,
				/*interface: dIface,
				ipversion: ipv,
				ip: ip,*/
				__exposedProps__: {
					tx: "r",
					rx: "r",
					/*httpsend: "r",
					httprecv: "r",*/
					time: "r",
					/*interface: "r",
					ipversion: "r",
					ip: "r"*/
				}
			};
			return retval;
		}
		return parseProcNetDev(obj);
		break;

	case "arpCache":
		function parseArpCache(info) {
			var arpCache = [];
			switch(tmpos) {
				case "Linux":
					var tmp = info.trim().split('\n');
					for(var k = 0; k < tmp.length; k++) {
						var i = tmp[k];
						var x = i.split(' ');
						var gateway = new Gateway();
						gateway.host = x[0];
						gateway.ip = x[1].replace(/\(|\)/gi,'');
						gateway.mac = x[3];
						gateway.interface = x[6];
						arpCache.push(gateway);
					}
					break;
				case "Darwin":
					var tmp = info.trim().split('\n');
					for(var k = 0; k < tmp.length; k++) {
						var i = tmp[k];
						var x = i.split(' ');
						var gateway = new Gateway();
						gateway.host = x[0];
						gateway.ip = x[1].replace(/\(|\)/gi,'');
						gateway.mac = x[3];
						gateway.interface = x[5];
						arpCache.push(gateway);
					}
					break;
				case "Windows":
					break;
				default:
					break;
			}
			return arpCache;
		}
		return parseArpCache(obj);
		break;

	case "wifiInfo":
		network.wireless.cells = [];
		function parseWirelessInfo(cellInfo) {
			switch(tmpos) {
				case "Linux":
					// split the info into cells
					var tmpCells = cellInfo.trim().split("Cell");
					for(var i = 1; i < tmpCells.length; i++) {
						var info = "Cell" + tmpCells[i];
					
						var x = new RegExp("Cell (.+) - Address: (.+)\\s+Channel:(.+)\\s+Frequency:(.+ GHz).+\\s+Quality=(.+).+ Signal level=(.+ dBm)\\s+Encryption key:(.+)\\s+ESSID:(.+)\\s+");
		
						var w = x.exec(info);
					
						var cell = new Cell(); 
						cell.id = w[1];
						cell.mac = w[2];
						cell.channel = w[3];
						cell.frequency = w[4];
						cell.quality = w[5];
						cell.signal = w[6];
						cell.encryption = w[7];
						cell.essid = w[8];
		
						cell.mode = /Mode:(.+)\s/.exec(info)[1];
						cell.lastBeacon = /Last beacon:(.+)\s/.exec(info)[1];
		
						var tmp = /Bit Rates:(.+)\s(.*)\s+Bit Rates:(.+)\s/.exec(info);
						if(tmp)
							cell.bitrate = tmp[1] + "; " + tmp[2] + "; " + tmp[3];
		
						network.wireless.cells.push(cell);
					}
					break;
				case "Darwin":
					var tmpCells = cellInfo.trim().split("\n");
					for(var i = 1; i < tmpCells.length; i++) {
						var info = tmpCells[i].trim().replace(/\s{2,}/g,' ');
						var cell = new Cell(); 
						var cols = info.split(' ');
						for(var j = 0; j < cols.length; j++) {
							cell.id = i;
							cell.mac = cols[1];
							cell.channel = cols[3];
							cell.signal = cols[2];
							cell.encryption = (cols[6]) ? "on" : "off";
							cell.essid = cols[0];
						}
					
						network.wireless.cells.push(cell);
					}
					break;
				case "Windows":
					break;
				default:
					break;
			}
			return network.wireless;
		}
		return parseWirelessInfo(obj);
		break;
		
	case "wifiStats":
		function parseProcNetWireless(info) {
			var wifi = {
				link: null,
				signal: null,
				noise: null,
				time: null,
				__exposedProps__: {
					link: "r",
					signal: "r",
					noise: "r",
					time: "r"
				}
			};

			wifi.time = Date.now();
			// parse the info
			switch (tmpos) {
			case "Linux":
			case "Android":
				var lines = info.trim().split("\n");
				// just 3 lines are printed on linux
				// less than 3 lines means no wifi adapter is present
				if (lines.length < 3) return;
				var line = lines[lines.length - 1];
				var elems = line.trim().replace(/\s{2,}/g, ' ').replace(/\./g, '').split(" ");
			    // Anna: the above is not valid - there can be multiple
			    // wireless interfaces, happens for example on
			    // androids that have wifi direct (named p2pX)
			    // -> adding an optional parameter to select the iface
			    if (params && params.length==1) {
				var iface = elems[0].replace(':','');
				if (params[0] === iface) {
				    wifi.link = elems[2];
				    wifi.signal = elems[3];
				    wifi.noise = elems[4];
				}
			    } else {
				// just pick the last line
				wifi.link = elems[2];
				wifi.signal = elems[3];
				wifi.noise = elems[4];
			    }
				break;
			case "Darwin":
				var lines = info.trim().split("\n");
				for (var i = 0; i < lines.length; i++) {
					var elems = lines[i].trim().replace(/\s{2,}/g, ' ').split(":");
					if (elems[0] == "agrCtlRSSI") wifi.signal = elems[1];
					if (elems[0] == "agrCtlNoise") wifi.noise = elems[1];
				}
				break;
			case "WINNT":
				var x = new RegExp("Signal\\s+:\\s+(.+)%");
				var elems = x.exec(info.trim());
				if (elems) wifi.link = elems[1];
				break;
			}
			return wifi;
		}
		return parseProcNetWireless(obj);
		break;

	case "activeWifiInterfaces":
	    // parses output of iwconfig, airport etc
	    function parse(info) {
		var iwconfig = {
		    mac : null,
		    proto: null,
		    ssid: null,
		    bssid : null,
		    mode: null,
		    freq: null,
		    channel: null,
		    name : null,
		    txpower : null,
		    signal : null,
		    noise : null,
		    bitrate : null,		    
		    __exposedProps__: {
			mac: "r",
			proto: "r",
			ssid: "r",
			bssid : "r",
			mode: "r",
			freq: "r",
			channel: "r",
			name : "r",
			txpower : "r",
			signal : "r",
			noise : "r",
			bitrate : "r",		    			
		    }
		};

		var lines = info.trim().split("\n");
		switch (tmpos.toLowerCase()) {
		case "linux":
		    var i;
		    for (i = 0; i<lines.length; i++) {
			var tmp = lines[i].split();
			if (lines[i].indexOf('ESSID')>=0) {
			    // wlan0     IEEE 802.11abgn  ESSID:"BISmark5-testbed"
			    iwconfig.name = tmp[0].trim();
			    iwconfig.proto = tmp[2].trim();
			    var tmp2 = tmp[3].trim().split(':');
			    iwconfig.ssid = tmp2[1].replace("\"",'');
			} else if (lines[i].indexOf('Mode:')>=0) {
			    // Mode:Managed  Frequency:5.18 GHz  Access Point: A0:21:B7:BB:17:54
			    var tmp2 = tmp[0].trim().split(':');
			    iwconfig.mode = tmp2[1];
			    tmp2 = tmp[1].trim().split(':');
			    iwconfig.freq = tmp2[1];
			    iwconfig.bssid = tmp[5];
			} else if (lines[i].indexOf('Bit Rate')>=0) {
			    // Bit Rate[=;]6 Mb/s   Tx-Power[=;]15 dBm
			    if (tmp[1].indexOf('=')>=0) { // fixed bitrate
				var tmp2 = tmp[1].trim().split('=');
				iwconfig.bitrate = tmp2[1];
			    } else { // auto bitrate
				var tmp2 = tmp[1].trim().split(';');
				iwconfig.bitrate = tmp2[1];
			    }

			    if (tmp[3].indexOf('=')>=0) { // fixed power
				var tmp2 = tmp[3].trim().split('=');
				iwconfig.txpower = tmp2[1];
			    } else if (tmp[3].indexOf('=')>=0) { // auto power
				var tmp2 = tmp[3].trim().split(';');
				iwconfig.txpower = tmp2[1];
			    } 

			} else if (lines[i].indexOf('Link Quality')>=0) {
			    // Link Quality=66/70  Signal level=-44 dBm 
			    if (tmp[3].indexOf('=')>=0) { // fixed
				var tmp2 = tmp[3].trim().split('=');
				iwconfig.signal = tmp2[1];
			    } else { // auto
				var tmp2 = tmp[3].trim().split(';');
				iwconfig.signale = tmp2[1];
			    }
			}
		    }
		    break;
		case "darwin":
		    var inwifiport = false;
		    var i;
		    for (i = 0; i<lines.length; i++) {
			var tmp = lines[i].trim().split(': ');
			if (tmp.length!=2)
			    continue;

			switch(tmp[0]) {
			case "agrCtlRSSI":
			    iwconfig.signal = tmp[1].trim();
			    break;
			case "agrCtlNoise":
			    iwconfig.noise = tmp[1].trim();
			    break;
			case "op mode":
			    iwconfig.mode = tmp[1].trim();
			    break;
			case "lastTxRate":
			    iwconfig.bitrate = tmp[1].trim();
			    break;
			case "BSSID":
			    iwconfig.bssid = tmp[1].trim();
			    break;
			case "SSID":
			    iwconfig.ssid = tmp[1].trim();
			    break;
			case "channel":
			    iwconfig.channel = tmp[1].trim();
			    break;
			case "Hardware Port":
			    if (tmp[1].trim() === "Wi-Fi")
				inwifiport = true;
			    else
				inwifiport = false;
			    break;
			case "Device":
			    if (inwifiport)
				iwconfig.name = tmp[1].trim();
			    break;
			case "Ethernet Address":
			    if (inwifiport)
				iwconfig.mac = tmp[1].trim();
			    break;
			};
		    }
		    break;
		case "android":
		    iwconfig.name = info.trim();
		    break;
		}
		return iwconfig;
	    }
	    return parse(obj);
	    break;

	default:
		break;
	};
}
