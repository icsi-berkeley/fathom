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

function square(x) {
    return x*x;
}

Components.utils.import("resource://fathom/SysUtils.jsm");

/*----------------------------------------------------------------------------*/

function percentile_prop(arr, p, obj) {
    var count = 0;
    for(var i = 0; i < arr.length; i++)
	if(arr[i][p] < obj[p])
	    count++;
    return (100*count/arr.length);
}

function percentile(arr, val) {
    var count = 0;
    var num = "";
    for(var i = 0; i < arr.length; i++)
	if(parseFloat(arr[i]) < parseFloat(val)) {
	    num += arr[i] + " ; ";
	    count++;
	}
    return (100*count/arr.length);
}

/*----------------------------------------------------------------------------*/

function avg_stddev_session(test_win, v, threshold) {
    var value = JSON.parse(v);
    var avgLoad = 1.0 * test_win.localStorage.getItem("avgLoad");
    var stdLoad = 1.0 * test_win.localStorage.getItem("stdLoad");
    function avg(val) {
	var load = 0;
	var domcontentloaded = 0;
	var httptotal = 0;
	var domains = [];
	var tmp = {};
	var loadCount = 0;
	var domcCount = 0;
	for(var i = 0; i < val.length-1; i++) {
	    var obj = val[i];
	    // do not include any outliers
	    if(percentile_prop(val, "load", obj) < 5 || percentile_prop(val, "load", obj) > 95) {
		loadCount++;
		continue;
	    }
	    if(!obj.load)
		loadCount++;
	    else {
		load += obj.load;
		httptotal += obj.httptotal;
	    }
	    if(!obj.domcontentloaded)
		domcCount++;
	    else
		domcontentloaded += obj.domcontentloaded;
	    var y = obj.domains;
	    for(var j = 0; j < y.length; j++) {
		if(!tmp[y[j].domain])
		    tmp[y[j].domain] = {dns:0, connect:0, data:0, time:0, datarate:0, rrt:0, count:0, inc:0};
		var x = tmp[y[j].domain];
		x.dns += y[j].dns;
		x.connect += y[j].connect;
		x.data += y[j].data;
		x.time += y[j].time;
		x.datarate += y[j].datarate;
		x.rrt += y[j].rrt;
		x.count += y[j].count;
		x.inc += 1;
	    }
	}
	for(var p in tmp) {
	    var x = tmp[p];
	    for(k in x)
		x[k] = (x[k]/x.inc).toFixed(3);
	}
	return({load: (load/(val.length-loadCount-1)).toFixed(3), 
		domcontentloaded: (domcontentloaded/(val.length-domcCount-1)).toFixed(3), 
		httptotal: (httptotal/(val.length-loadCount-1)).toFixed(3), 
		domains: tmp});
    }

    var mean = avg(value);

    function stddev(val, mn) {
	var load = 0;
	var domcontentloaded = 0;
	var domains = [];
	var tmp = {};
	var loadCount = 0;
	var domcCount = 0;
	var httptotal = 0;
	for(var i = 0; i < val.length-1; i++) {
	    var obj = val[i];
	    // do not include any outliers
	    if(percentile_prop(val, "load", obj) < 5 || percentile_prop(val, "load", obj) > 95) {
		loadCount++;
		continue;
	    }
	    if(!obj.load)
		loadCount++;
	    else {
		load += square(obj.load - mn.load);
		httptotal += square(obj.httptotal - mn.httptotal);
	    }
	    if(!obj.domcontentloaded)
		domcCount++;
	    else
		domcontentloaded += square(obj.domcontentloaded - mn.domcontentloaded);
	    var y = obj.domains;
	    for(var j = 0; j < y.length; j++) {
		if(!tmp[y[j].domain])
		    tmp[y[j].domain] = {dns:0, connect:0, data:0, time:0, datarate:0, rrt:0, count:0, inc:0};
		var x = tmp[y[j].domain];
		var z = mn.domains[y[j].domain];
		x.dns += square(y[j].dns - z.dns);
		x.connect += square(y[j].connect - z.connect);
		x.data += square(y[j].data - z.data);
		x.time += square(y[j].time - z.time);
		x.datarate += square(y[j].datarate - z.datarate);
		x.rrt += square(y[j].rrt - z.rrt);
		x.count += square(y[j].count - z.count);
		x.inc += 1;
	    }
	}
	for(var p in tmp) {
	    var x = tmp[p];
	    for(k in x)
		x[k] = Math.sqrt(x[k]/x.inc).toFixed(3);
	}
	return({load: Math.sqrt(load/(val.length-loadCount-1)).toFixed(3), 
		domcontentloaded: Math.sqrt(domcontentloaded/(val.length-domcCount-1)).toFixed(3), 
		httptotal: Math.sqrt(httptotal/(val.length-loadCount-1)).toFixed(3), 
		domains: tmp});
    }

    var std = stddev(value, mean);
    
    test_win.localStorage.setItem("avgLoad", mean.load);
    test_win.localStorage.setItem("stdLoad", std.load);
    
    return({mean: mean, stddev: std})
}

/*----------------------------------------------------------------------------*/

function avg_stddev_baseline(b) {
    var obj = b;
    var cpu = avg_stddev_cpu(obj.cpu);
    var wifi = avg_stddev_wifi(obj.wifi);
    return ({cpu: cpu, wifi: wifi});

    function avg_stddev_cpu(value) {
	// loadavg = []
	// tasks = {total, running, sleeping}
	// cpu = {user, system, idle}
	// memory = {total, used, free}
	function avg(val) {
	    //var loadavg = [0, 0, 0];
	    var tasks = {total:0, running:0, sleeping:0};
	    var cpu = {user:0, system:0, idle:0};
	    var memory = {total:0, used:0, free:0};
	    for(var i = 0; i < val.length; i++) {
		// total for load
		//for(var k = 0; k < val[i].loadavg.length; k++)
		//	loadavg[k] += 1*val[i].loadavg[k];
		// tasks, cpu, memory
		for(var p in val[i].tasks)
		    tasks[p] += 1*val[i].tasks[p];
		for(var p in val[i].cpu)
		    cpu[p] += 1*val[i].cpu[p];
		for(var p in val[i].memory)
		    memory[p] += 1*(val[i].memory[p]);
	    }

	    // avg for load
	    //for(var k = 0; k < loadavg.length; k++)
	    //	loadavg[k] = (loadavg[k]/val.length).toFixed(3);
	    // avg for tasks, cpu, memory
	    for(var p in tasks)
		tasks[p] = (tasks[p]/val.length).toFixed(3);
	    for(var p in cpu)
		cpu[p] = (cpu[p]/val.length).toFixed(3);
	    for(var p in memory)
		memory[p] = (memory[p]/val.length).toFixed(3);

	    return({/*loadavg: loadavg,*/ tasks: tasks, cpu: cpu, memory: memory});
	}

	var mean = avg(value);

	function stddev(val, mn) {
	    //var loadavg = [0, 0, 0];
	    var tasks = {total:0, running:0, sleeping:0};
	    var cpu = {user:0, system:0, idle:0};
	    var memory = {total:0, used:0, free:0};
	    for(var i = 0; i < val.length; i++) {
		// total for load
		//for(var k = 0; k < val[i].loadavg.length; k++)
		//	loadavg[k] += square(1*val[i].loadavg[k] - mn.loadavg[k]);
		// tasks, cpu, memory
		for(var p in val[i].tasks)
		    tasks[p] += square(1*val[i].tasks[p] - mn.tasks[p]);
		for(var p in val[i].cpu)
		    cpu[p] += square(1*val[i].cpu[p] - mn.cpu[p]);
		for(var p in val[i].memory)
		    memory[p] += square(1*(val[i].memory[p] - mn.memory[p]));
	    }

	    // avg for load
	    //for(var k = 0; k < loadavg.length; k++)
	    //	loadavg[k] = Math.sqrt(loadavg[k]/val.length).toFixed(3);

	    // avg for tasks, cpu, memory
	    for(var p in tasks)
		tasks[p] = Math.sqrt(tasks[p]/val.length).toFixed(3);

	    for(var p in cpu)
		cpu[p] = Math.sqrt(cpu[p]/val.length).toFixed(3);

	    for(var p in memory)
		memory[p] = Math.sqrt(memory[p]/val.length).toFixed(3);

	    return({/*loadavg: loadavg,*/ tasks: tasks, cpu: cpu, memory: memory});	}

	var std = stddev(value, mean);
	return({mean: mean, stddev: std})
    }

    function avg_stddev_wifi(value) {

	function avg(val) {
	    var link = 0;
	    var signal = 0;
	    var noise = 0;
	    for(var i = 0; i < val.length; i++) {
		link += 1 * val[i].link;
		signal += 1 * val[i].signal;
		noise += 1 * val[i].noise;
	    }
	    return({link: (link/val.length).toFixed(3), 
		    signal: (signal/val.length).toFixed(3), 
		    noise: (noise/val.length).toFixed(3)});
	}

	var mean = avg(value);

	function stddev(val, mn) {
	    var link = 0;
	    var signal = 0;
	    var noise = 0;
	    for(var i = 0; i < val.length; i++) {
		link += square(1*val[i].link - mn.link);
		signal += square(1*val[i].signal - mn.signal);
		noise += square(1*val[i].noise - mn.noise);
	    }
	    return({link: Math.sqrt(link/val.length).toFixed(3), 
		    signal: Math.sqrt(signal/val.length).toFixed(3), 
		    noise: Math.sqrt(noise/val.length).toFixed(3)});
	}

	var std = stddev(value, mean);
	return({mean: mean, stddev: std})
    }
}

/*----------------------------------------------------------------------------*/

function TrafficStats(b, delta) {
    //var obj = b;
    var trf = b;//obj.crosstraffic;
    var traffic = [];
    
    for(var i = trf.length - 1; i >= 0; i--) {
	if(1*trf[trf.length - 1].time < (1*trf[i].time + delta)) {
	    traffic.push(trf[i]);
	} else
	    break;
    }
    
    traffic.reverse();
    
    var len = traffic.length;

    if(!len) {
	//log("traffic len = " + traffic.length);
	return null;
    }

    /*log("traffic len = " + traffic.length + " : start ts = " + traffic[0].time)

    // interface is down
    if(traffic[len-1].interface == null)
    log("Interface is down : interface = " + traffic[len-1].interface)
    //return null;*/

    var ipv = traffic[len-1].ipversion;

    var txbytes = traffic[len-1].tx.bytes - traffic[0].tx.bytes;
    var rxbytes = traffic[len-1].rx.bytes - traffic[0].rx.bytes;

    var txpkts = traffic[len-1].tx.packets - traffic[0].tx.packets;
    var rxpkts = traffic[len-1].rx.packets - traffic[0].rx.packets;

    var httpsend = traffic[len-1].httpsend - traffic[0].httpsend;
    var httprecv = traffic[len-1].httprecv - traffic[0].httprecv;
    
    // now make a guess -- we discount any optional TCP timestamps
    // if ipv4 then avg overhead is 20 + 20 + 14 = 54
    // if ipv6 then avg overhead is 40 + 20 + 14 = 74
    
    var overhead = 0, txoverhead = 0, rxoverhead = 0;
    
    if(ipv == "IPv6")
	overhead = 74;
    else
	overhead = 54;
    
    txoverhead = txpkts * overhead;
    rxoverhead = rxpkts * overhead;
    
    var possibleHTTPBytesTx = txbytes - txoverhead;
    var possibleHTTPBytesRx = rxbytes - rxoverhead;
    
    var txDelta = (httpsend/possibleHTTPBytesTx).toFixed(3);
    var rxDelta = (httprecv/possibleHTTPBytesRx).toFixed(3);
    
    var time = traffic[len-1].time + " :: " + traffic[0].time;
    
    var txerrs = traffic[len-1].tx.errs - traffic[0].tx.errs;
    var rxerrs = traffic[len-1].rx.errs - traffic[0].rx.errs;
    
    var txdrops = traffic[len-1].tx.drops - traffic[0].tx.drops;
    var rxdrops = traffic[len-1].rx.drops - traffic[0].rx.drops;
    
    return {http: {tx: txDelta, rx: rxDelta, send: httpsend, recv: httprecv}, 
	    errors: {tx: txerrs, rx: rxerrs}, drops: {tx: txdrops, rx: rxdrops}, 
	    time: time};
}

/*----------------------------------------------------------------------------*/

function FFxMemoryUsage(b) {
    //var obj = b;
    var mem = b;//obj.ffxMemory;
    var ffmem = [];
    var total = 0;
    var tmp = 0;
    var end = (mem.length > 120) ? mem.length - 120 : 0;
    for(var i = mem.length - 1; i >= end; i--) {
	ffmem.push(1 * mem[i].memory);
	total += 1 * mem[i].memory;
    }
    var mean = (total / (mem.length-end)).toFixed(3);
    for(var i = mem.length - 1; i >= end; i--) {
	tmp += square(1 * mem[i].memory - mean);
    }
    var stddev = Math.sqrt(tmp/(mem.length-end)).toFixed(3);
    ffmem.sort();
    
    var Mmax = 0;
    var Mmin = 1000;
    
    for(var k = 0; k < ffmem.length; k++) {
	if(Mmax < ffmem[k])
	    Mmax = ffmem[k];
	if(Mmin > ffmem[k])
	    Mmin = ffmem[k];
    }
    
    return {mean : mean, stdev: stddev, max: Mmax, min: Mmin};
}

/*----------------------------------------------------------------------------*/

function TestWiFi(win, threshold) {
    var baseline = avg_stddev_baseline({ cpu: [], wifi: win.fathom.util.baseline("wifi") });
    var sysmean = baseline.wifi.mean;
    var sysstd = baseline.wifi.stddev;

    var tmp = win.fathom.util.baseline("wifi");

    if (!tmp || tmp.length < 1) {
        log("No wifi detected", "wifi", 0);
        return;
    }

    var syscurr = tmp[tmp.length - 1];

    /* Is the wifi link quality < normal */
    var link = syscurr.link * 1.0;
    var tmpos = win.fathom.util.os();
    
    switch (tmpos) {
    case "WINNT":
        if (link > Math.ceil(sysstd.link * threshold + 1 * sysmean.link))
            log("Wifi link quality is much lower than normal. Link = " + 
		link + "%, mean = " + sysmean.link + "%, stdev = " + 
		sysstd.link + "%", "wifi", -1);
        else
            log("Wifi link quality is ok. Link = " + link + "%, mean = " + 
		sysmean.link + "%, stdev = " + sysstd.link + "%", "wifi", 1)
        break;

    case "Linux":
    case "Darwin":
        if (link > Math.ceil(sysstd.link * threshold + 1 * sysmean.link))
            log("Wifi link quality is much lower than normal. Link = " + 
		link + "/70, mean = " + sysmean.link + "/70, stdev = " + 
		sysstd.link + "/70", "wifi", -1);
        else
            log("Wifi link quality is ok. Link = " + link + "/70, mean = " + 
		sysmean.link + "/70, stdev = " + sysstd.link + "/70", "wifi", 1)
        break;
    }
}

/*----------------------------------------------------------------------------*/

function TestHost(win, threshold, delta) {
    /*
     * Is there a spike in the FFx memory usage ?
     * Is there a spike in the system memory usage ?
     * Is current CPU usage higher ? 
     * Is HTTP traffic tx/rx from browser < 50% ?
     * Is the # processes higher ?
     */
    
    var ffxMemuse = false;
    var sysmemuse = false;
    var syscpuuse = false;
    var syshttprxuse = false;
    var syshttptxuse = false;
    var sysprocess = false;
    
    /* Is there a spike in the FFx memory usage */
    /* some webpage, plugin or addon is the issue */
    var ffx = FFxMemoryUsage(win.fathom.util.baseline("ffxMemory"));
    if((ffx.max - ffx.min) > ffx.stdev*threshold)
	ffxMemuse = true;
    if(ffxMemuse)
	log("There is a spike in Firefox's resident memory usage.<br><br>Mean = " + 
	    ffx.mean + " MB, stdev = " + ffx.stdev + " MB, Max = " + ffx.max + 
	    " MB, Min = " + ffx.min + " MB", "ffx_memory", 0);
    else
	log("Firefox's resident memory usage is ok.<br><br>Mean = " + ffx.mean + 
	    " MB, stdev = " + ffx.stdev + " MB, Max = " + ffx.max + " MB, Min = " + 
	    ffx.min + " MB", "ffx_memory", 1);

    var baseline = avg_stddev_baseline({cpu: win.fathom.util.baseline("cpu"), wifi: []});
    var sysmean = baseline.cpu.mean;
    var sysstd = baseline.cpu.stddev;

    var tmp = win.fathom.util.baseline("cpu");
    if(!tmp || tmp.length < 1) {
	log("No CPU information detected", "system_cpu", 0);
	log("No memory information detected", "system_memory", 0);
	log("No task information detected", "system_task", 0);
    } else {
	var syscurr = tmp[tmp.length - 1];
	
	/* Is the system memory usage > normal usage */
	var memuse = syscurr.memory.used * 1.0;
	if(memuse > Math.ceil(sysstd.memory.used*threshold + 1*sysmean.memory.used))
	    sysmemuse = true;
	if(sysmemuse)
	    log("System's memory usage is much larger than normal. Current memory use = " + 
		(memuse/1024).toFixed(2) + " MB, Mean = " + (sysmean.memory.used/1024).toFixed(2) + 
		" MB, stdev = " + (sysstd.memory.used/1024).toFixed(2) + " MB", "system_memory", 0);
	else
	    log("System memory usage is OK. Current memory use = " + (memuse/1024).toFixed(2) + 
		" MB, Mean = " + (sysmean.memory.used/1024).toFixed(2) + " MB, stdev = " + 
		(sysstd.memory.used/1024).toFixed(2) + " MB", "system_memory", 1);
	
	/* Is the cpu usage > normal usage */
	var cpuuse = 1*syscurr.cpu.user;
	if(cpuuse > Math.ceil(sysstd.cpu.user*threshold + 1*sysmean.cpu.user))
	    syscpuuse = true;
	if(syscpuuse)
	    log("System's CPU usage is much larger than normal. % CPU use = " + 
		cpuuse + ", mean (%) = " + sysmean.cpu.user + ", stdev (%) = " + 
		sysstd.cpu.user, "system_cpu", 0);
	else
	    log("System CPU usage is OK. % CPU use = " + cpuuse + ", mean (%) = " + 
		sysmean.cpu.user + ", stdev (%) = " + sysstd.cpu.user, "system_cpu", 1);

	/* Are the # of processes > normal usage */
	var pr = syscurr.tasks.total;
	if(pr > Math.ceil(sysstd.tasks.total*threshold + 1*sysmean.tasks.total))
	    sysprocess = true;
	if(sysprocess)
	    log("# OS processes is much larger than normal. # process = " + pr 
		+ ", Mean = " + sysmean.tasks.total + ", Stdev = " + 
		sysstd.tasks.total, "system_task", 0);
	else
	    log("# OS processes is ok. # process = " + pr + ", Mean = " + 
		sysmean.tasks.total + ", Stdev = " + sysstd.tasks.total, "system_task", 1);
    }

    setTimeout(function() {
	/* Is the http usage < normal usage */
	var httpuse = TrafficStats(win.fathom.util.baseline("traffic"), delta);
	/* The value represents the %age of traffic attributed to the browser */
	/* A value < 50% means that there is heavy cross-traffic on the host */
	if(1*httpuse.http.rx < 0.5 && 1*httpuse.http.rx > 0)
	    syshttprxuse = true;
	if(syshttprxuse)
	    log("RX Cross-traffic on the host is much larger than normal." + 
		httpuse.http.rx*100 + "% of total RX traffic is from the browser.", 
		"rx_traffic", -1);
	else {
	    if(1*httpuse.http.rx == 0) {
		log("No RX cross-traffic in the past 30 sec. " + httpuse.http.rx*100 + 
		    "% of total RX traffic is from the browser.", "rx_traffic", 0);
	    } else if(isNaN(httpuse.http.rx) || !isFinite(httpuse.http.rx)) {
		log("No RX cross-traffic, no network connectivity.", "rx_traffic", -1);
	    } else
		log("RX Cross-traffic is ok. " + httpuse.http.rx*100 + 
		    "% of total RX traffic is from the browser.", "rx_traffic", 1);
	}
	
	if(1*httpuse.http.tx < 0.5 && 1*httpuse.http.tx > 0)
	    syshttptxuse = true;
	if(syshttptxuse)
	    log("TX Cross-traffic on the host is much larger than normal." + 
		httpuse.http.tx*100 + "% of total TX traffic is from the browser.", 
		"tx_traffic", -1);
	else {
	    if(1*httpuse.http.tx == 0) {
		log("No TX cross-traffic in the past 30 sec. " + httpuse.http.tx*100 + 
		    "% of total TX traffic is from the browser.", "tx_traffic", 0);
	    } else if(isNaN(httpuse.http.tx) || !isFinite(httpuse.http.tx)) {
		log("No TX cross-traffic, no network connectivity.", "tx_traffic", -1);
	    } else
		log("TX Cross-traffic is ok. " + httpuse.http.tx*100 + 
		    "% of total TX traffic is from the browser.", "tx_traffic", 1);
	}
    }, 5000);
}

function TestProxyPresence(chrome_win, win) {

    try {
	var proxy = chrome_win.fathom.system.getProxyInfo(win.location);
    } catch (e) {
	proxy = chrome_win.fathom.system.getProxyInfo("http://www.google.com");
    }
    /*if(proxy.host) {
      log("User-configured proxy found : host = " + proxy.host + " :: port = " + proxy.port, "proxy", 1);
      }*/
    return (proxy.host ? proxy : null);
}

function TestDNSReachability(syscmd) {

    function NameServer(info) {
	if(info && info.list && info.list.length > 0) {
	    //log("Name server = " + info.list[0]);
	    nameserverip = info.list[0];
	    //alert(nameserverip)
	    function cbk(info) {
		var verdict = 0;
		if(1*info.stats.packets.lost > 0)
		    verdict = -1;
		else
		    verdict = 1;
		log("DNS : Ping packets for [" + nameserverip + "] lost = " + 
		    info.stats.packets.lost + "%.", "dns", verdict);
	    }
	    syscmd.ping(cbk, nameserverip, 4);
	    
	} else
	    log("Name server not found.", "dns", -1);
    }
    //alert("testing for nameserver: syscmd = " + syscmd);
    //alert(" nameserver = " + syscmd.nameserver);
    syscmd.nameserver(NameServer);
}

function TestServerReachability(win, bool, syscmd) {

    try {
	var url = win.location.href;
	var host = win.location.hostname;
    } catch(e) {
    }
    
    try {
	if(win.location == '' || win.location == 'about:blank' || win.location.protocol == 'chrome:') {	
	    url = "http://www.google.com";
	    host = "www.google.com";
	}
    } catch(e) {
	url = "http://www.google.com";
	host = "www.google.com";
    }

    if(!bool) {
	log("Server : Cannot ping the server because the interface is down.", "server", -1);
	return;
    }

    function cback(info) {
	var verdict = 0;
	if(1*info.stats.packets.lost > 0)
	    verdict = -1;
	else
	    verdict = 1;
	log("Server : Ping packets for [" + host + "] lost = " + 
	    info.stats.packets.lost + "%.", "server", verdict);
    }

    function fcbk(dns) {
	if(dns)
	    syscmd.ping(cback, dns.ip[0], 2);
	else
	    log("Server : Cannot ping the server because no DNS record was returned.", "server", -1);
    }

    syscmd.dnsResolution(fcbk, url);
}

function TestInterface(win) {
    // check if the last entry in the baseline has interface is null
    var obj = win.fathom.util.baseline("traffic");
    var traffic = obj;//.crosstraffic;
    var len = traffic.length;

    if(!len)
	return false;

    // interface is down
    if(traffic[len-1].interface == null)
	return false;

    return traffic[len-1].interface + ", IP = " + traffic[len-1].ip;
}

function GetLastKnownInterface(win) {
    // check if the last entry in the baseline has interface is null
    var obj = win.fathom.util.baseline("traffic");
    var traffic = obj;//.crosstraffic;
    var len = traffic.length;

    if(!len)
	return false;

    // interface is down, so get the lask known interface and ip
    for(var i = len-1; i > 0; i--) {
	if(traffic[i].interface) {
	    return traffic[i].interface + ", IP = " + traffic[i].ip;
	}
    }

    return false;
}

/*----------------------------------------------------------------------------*/

function commonTest(chrome_win, test_win, currentSession, session, threshold, activity) {
    var retval = true;
    var intfUp = true;

    var syscmd = new SysUtils(chrome_win.fathom);

    /* check interface up/down */
    intfUp = TestInterface(chrome_win);
    if(!intfUp) {
	retval = GetLastKnownInterface(chrome_win);
	if(retval) {
	    log("Your default interface is disabled. The previous active interface was " + retval, "interface", -1);
	} else { 
	    log("Your default interface is disabled. Could not retrieve last good interface configuration.", "interface", -1);
	}
    } else {
	log("Your default interface is " + intfUp + " and it is up.", "interface", 1);
    }

    /* proxy configured */
    retval = TestProxyPresence(chrome_win, test_win);
    if(!retval) {
	log("No user-configured proxy detected.", "proxy", 1);
    } else {
	log("Proxy is configured as " + retval.host + ":" + retval.port, "proxy", 0);
    }

    /* reachability to the local/remote dns server */
    retval = TestDNSReachability(syscmd);
    /* reachability to the remote server */
    retval = TestServerReachability(test_win, intfUp, syscmd);
    // check for wifi, cross-traffic and host load.
    TestWiFi(chrome_win, threshold);
    TestHost(chrome_win, threshold, 30000);
}

function TestNetwork(chrome_window, win, threshold) {

    try {
	var s = JSON.parse(win.localStorage.session);
	var activity = 0;
	if(s) {
	    currentSession = s[s.length - 1];
	    var retval = true;
	    for(var i = 0; i < currentSession.domains.length; i++) {
		activity += (1*currentSession.domains[i].data);
	    }

	    var activityArray = [];
	    for(var i = 0; i < s.length; i++) {
		var obj = s[i];
		var act = 0;
		for(var j = 0; j < obj.domains.length; j++)
		    act += obj.domains[j].data;
		activityArray.push(act);
	    }

	    /* is the activity within 10,90 percentile */
	    var pc = percentile(activityArray, activity);
	    if(pc > 90) {
		log("Downloaded data in the current session is greater than usual. [ Activity = " + activity + " bytes ]", "comment", -1);
	    } else if (pc < 10) {
		log("Downloaded data in the current session is less than usual. [ Activity = " + activity + " bytes ]", "comment", -1);
	    } else
		log("Downloaded data in the current session is normal. [ Activity = " + activity + " bytes ]", "comment", 1);
	} else
	    log("Downloaded data in the current session is less than usual. [ Activity = " + activity + " bytes ]", "comment", -1);
    } catch (e) {
	log("Downloaded data in the current session is less than usual. [ Activity = " + activity + " bytes ]", "comment", -1);
    }
    commonTest(chrome_window, win, currentSession, s, threshold, activity);
}

/*----------------------------------------------------------------------------*/

