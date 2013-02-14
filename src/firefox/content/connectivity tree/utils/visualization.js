function display(tmpjson, div) {
	$("#" + div).empty();
	var json = JSON.parse(tmpjson);
	var width = 200,
		height = 250,
		mroot = json[0],
		data = [mroot],
		mtree = d3.layout.tree().size([width - 50, height - 50]),
		diagonal = d3.svg.diagonal(),
		duration = 500,
		radius = 10;

	var vis = d3.select("body")
		.select("#" + div)
		.append("svg")
		.attr("width", width)
		.attr("height", height)
		.append("g")
		.attr("transform", "translate(" + radius + ", " + radius + ")");

	vis.selectAll("circle")
	.data(mtree(mroot))
	.enter().append("circle")
	.attr("class", json[0].result)
	.attr("r", radius)
	.attr("cx", x)
	.attr("cy", y);

	// Add a new datum to a parent.
	for(var i = 1; i < json.length; i++) {
		var d = json[i];
		var parent = data[d.parent];
		if (parent.children)
			parent.children.push(d);
		else
			parent.children = [d];
		data.push(d);
	}
	
	// Compute the new tree layout. We'll stash the old layout in the data.
	var nodes = mtree.nodes(mroot);

	// Update the nodes…
	var node = vis.selectAll("circle.node")
	  .data(nodes, function(d) { return d.id; });

	// Enter any new nodes at the parent's previous position.
	node.enter().append("circle")
	  .attr("class", function(d) {
	  	return d.result;
	  })
	  .attr("r", radius)
	  .attr("cx", function(d) { return d.parent.x0; })
	  .attr("cy", function(d) { return d.parent.y0; });

	// Transition nodes to their new position.
	node.transition()
		.duration(duration)
		.attr("cx", x)
		.attr("cy", y);

	// Update the links…
	var link = vis.selectAll("path.link")
	.data(mtree.links(nodes), function(d) { 
		return d.target.id;
	});

	// Enter any new links at the parent's previous position.
	link.enter().insert("path", "circle")
	  .attr("class", "link");

	// Transition links to their new position.
	link.transition()
	  .duration(duration)
	  .attr("d", diagonal);
	
	/* set text */
	vis.selectAll("circle.node")
	.data(nodes, function(d) {
		var title = vis.append("g")
			.attr("text-anchor", "middle")
			.attr("transform", "translate(" + d.x + "," + d.y + ")");

		title.append("text")
			.attr("class", "title")
			.text(d.name);
	});
	
	/* add tool tip */
	node.on("mouseover", function (d) {
		var divPos = $("#" + div).position();
		d3.select(this).attr("r", 2*radius);
		var mesg = d.info;
		var pLeft = divPos.left + d.x + 50, pTop = divPos.top + d.y;
		$("#pop-up").fadeOut(100,function () {
			// Popup content
			$("#pop-up").html(mesg);
			// Popup position
			$("#pop-up").css({"left": pLeft, "top": pTop});
			$("#pop-up").fadeIn(100);
		});
	}).
	on("mouseout",function () {
		$("#pop-up").fadeOut(50);
		d3.select(this).attr("r", radius);
	});
	
	return vis;
}

function x(d) {
	return d.x0 = d.x;
}

function y(d) {
	return d.y0 = d.y;
}

/* Miscellaneous */

function updateJSON(num, json) {
	for(var i = 0; i < json.length; i++) {
		var id = json[i].id;
		/* get result */
		var item = document.getElementById("t_short_" + num + "_" + id);
		var children = item.childNodes;
		if(children.length != 1)
			alert("ERROR !!! Child length != 1.");
		else {
			var result = parseInt(children[0].className.substring(3));
			json[i].result = "node" + (result == 1 ? "_done" : (result == 3 ? "_fail" : (result == 2 ? "_shortcut" : "")));
		}
		/* get output */
		var item = document.getElementById("t_data_" + num + "_" + id);
		var children = item.childNodes;
		if(children.length != 2)
			alert("ERROR !!! Child length != 2.");
		else {
			json[i].info = children[1].innerHTML;
		}
	}
	//alert(JSON.stringify(json));
	return json;
}
