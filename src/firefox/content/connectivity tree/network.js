(function () {
	var isAndroid = (/android/i).test(navigator.userAgent.toLowerCase());
	var num = 2;
	var loadTest = function(item) { 
		return eval("_text_" + item); 
	};
	/* load the tests */
	var routing_table = loadTest("routing_table_js");
	if(!isAndroid)
		var traceroute = loadTest("traceroute_js");

	/* create the test tree */
	var tree = new Tree();

	var t0 = tree.addRoot(new routing_table());
	if(!isAndroid)
		var t1 = tree.addChild(t0, new traceroute());

	/* add the visualization */
	var html = visualize(num, "Network/Transport-level Tests", tree.toJSON());
	$("#result").append(html);
	
	/* execute the tests */
	tree.traverse(null, num);

	/* delete tree to prevent memory leaks */
	delete tree;
})();
