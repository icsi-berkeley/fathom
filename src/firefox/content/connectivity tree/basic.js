(function () { 
	var num = 1;
	var loadTest = function(item) { 
		return eval("_text_" + item); 
	}; 
	/* load the tests */ 
	var interfaces = loadTest("interfaces_js"); 
	var active_interface = loadTest("active_interface_js"); 
	var auto_configuration = loadTest("auto_configuration_js"); 
	var nameserver = loadTest("nameserver_js"); 

	/* create the test tree */ 
	var tree = new Tree(); 

	var t0 = tree.addRoot(new interfaces()); 
	var t1 = tree.addChild(t0, new active_interface()); 
	var t2 = tree.addChild(t1, new auto_configuration()); 
	var t3 = tree.addChild(t2, new nameserver()); 

	/* add the visualization */ 
	var json = tree.toJSON();
	var html = visualize(num, "General Connectivity Tests", json); 
	$("#result").append(html); 
	
	/* execute the tests */ 
	tree.traverse(null, num); 

	/* delete tree to prevent memory leaks */ 
	delete tree; 
})();
