var Node = function(test) {
	this.test = test;
	this.children = [];
}

Node.prototype = {
	parent: null,
	children: null,
	test: null
}

var Tree = function() {
}

Tree.prototype = {
	root: null,
	
	addRoot: function(root) {
		this.root = root;
		return this.root;
	},
	
	addChild: function(parent, child) {
		if(!this.root) {
			this.root = parent;
		}
		
		parent.children.push(child);
		child.parent = parent;
		return child;
	},
	
	traverse: function(node, num) {
		
		var count = 0;
	
		/* if no node is provided then use the root node */
		if(!node)
			node = this.root;
	
		/* this is a breadth-first traversal */
		var queue = [];
		queue.push(node);
		
		while(queue.length > 0) {
			var item = queue.shift();
			item.id = count;
			item.test.id = item.id;

			// if a shortcut exists, then execute it
			if(item.test.shortcut) {
				item.test.shortcut();
				while (!item.test.shortcutExecuted) {
					//thread.processNextEvent(true);
					window.fathom.util.processNextEvent(true);
				}
				// if shortcut test succeeds then no need to add a sub-tree
				if(item.test.shortcutResult) {
					item.test.progress = FINISHED;
					// mark the test as done only if finished
					//change_node_color(item.id, "shortcut", item.test.msg);
					/* print the result of the test */
					//addAccordion(item.test.name, logText(item.test, "Shortcut executed."));
					updateResults(num, item.test.name, item.id, "done");
					count++;
					continue;
				}
			}
			
			//if the result of the shortcut test is false, then run the test
			var retval = item.test.run();

			var start = (new Date()).getTime();
			while (!item.test.cbExecuted && retval) {
				var curr = (new Date()).getTime();
				if((curr - start) > item.test.cbTimeout) {
					retval = false;
					item.test.progress = ERROR;
					break;
				}
				//thread.processNextEvent(true);
				window.fathom.util.processNextEvent(true);
			}

			/* insert the output as the last element of the children's input argument */
			for(var i = 0; i < item.children.length; i++) {
				var child = item.children[i];
				if(!child)
					continue;
				if(!child.test.input)
					child.test.input = [];
				if(item.test.output)
					child.test.input.push(item.test.output);
				//if((item.test.output && item.test.execChildren) || !item.test.output) 
				if(item.test.execChildren) 
					queue.push(child);
			}
			
			if(retval) {
				item.test.progress = FINISHED;
				var tmpMsg = null;
				// mark the test as done only if finished
				if(!item.test.output) {
					//change_node_color(item.id, "fail", item.test);
					tmpMsg = item.test.failureMsg;
					updateResults(num, item.test.name, item.id, "fail", tmpMsg, item.test.msg);					
				} else {
					//change_node_color(item.id, "done", item.test);
					tmpMsg = item.test.successMsg;
					updateResults(num, item.test.name, item.id, "done", tmpMsg, item.test.msg);					
				}
				log(0, item.test, "<br></br><b>Result: " + tmpMsg + "</b>");
				/* print the result of the test */
				//addAccordion(item.test.name, logText(item.test));
			} else {
				var code = "Incomplete / Unknown";
				if (!item.test.status ||
						item.test.progress == ERROR)
					code = "Error";
				//change_node_color(item.id, "fail", item.test);
				var tmpMsg = item.test.failureMsg;
				updateResults(num, item.test.name, item.id, "fail", tmpMsg, item.test.msg);				
				log(0, item.test, tmpMsg);
				//addAccordion(item.test.name, logText(item.test, code));
			}
			count++;
		}
		removeSpinners();
	},
	
	toJSON: function() {
	
		/* this is a BFS traversal */
		var queue = [this.root];
		
		var root_node = {};
		var data = [];
		var dd = {name: this.root.test.name, id: data.length, parent:0, desc: { short: this.root.test.shortDesc, long: this.root.test.longDesc}, result: "", info: "" };
		data.push(dd);

		while(queue.length > 0) {
		
			item = queue.shift();
		
			if(!item.parent) {
				item.parent = root_node;
				root_node.id = 0;
				item.position = 0;
			}
			
			item.id = item.position;

			for(var i = 0; i < item.children.length; i++) {
				var child = item.children[i];
				queue.push(child);
				child.parent = item;
				child.position = data.length;
				var parent = data[item.id];
				dd = {name: child.test.name, id: data.length, parent: item.id, desc: { short: child.test.shortDesc, long: child.test.longDesc}, result: "", info: "" };
				//if (parent.children) parent.children.push(dd); else parent.children = [dd];
				data.push(dd);
			}			
		}

		return data;
	}
}
