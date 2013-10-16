var uploadOptions = {

	table: {
		passive: {
			cpu: false,
			tasks: false,
			memory: false,
			tx: false,
			rx: false,
			httpsend: false,
			httprecv: false,
			link: false,
			signal: false,
			noise: false,
			browser: false,
			memoryUsage: false,
			os: false,
			dns: false,
			interface: false
		},
		debugConnection: {
			interfaces0: false,
			configuration0: false,
			auto0: false,
			routing0: false,
			traceroute0: false,
			nameservers0: false,
			lookup_standard0: false,
			http0: false
		},
		netError: {
			uri: false,
			cause: false,
			interfaces: false,
			configuration: false,
			auto: false,
			routing: false,
			traceroute: false,
			nameservers: false,
			lookup: false,
			lookup_cd: false,
			lookup_public: false,
			lookup_standard: false,
			tcp: false,
			http: false,
			https: false,
			user_proxy: false,
			proxy_available: false,
			http_common: false
		}
	},
	
	gBrowser: function() {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
		var recentWindow = wm.getMostRecentWindow("navigator:browser");
		if(recentWindow)
			return recentWindow.gBrowser;
		return null;
	},

	save: function () {
		var value = JSON.stringify(uploadOptions.table);
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		pref.setCharPref("extensions.fathom.dataUploadPreferences", value);
		var gBrowser = uploadOptions.gBrowser();
		if(gBrowser)
			gBrowser.removeCurrentTab();
	},
	
	cancel: function () {
		var gBrowser = uploadOptions.gBrowser();
		if(gBrowser)
			gBrowser.removeCurrentTab();
	},

	init: function() {
		// read from saved preferences
		var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var value = pref.getCharPref("extensions.fathom.dataUploadPreferences");
		// populate the table
		if(value)
			uploadOptions.table = JSON.parse(value);
		// checkmark the check box and show the list
		var time = pref.getIntPref("extensions.fathom.dataUploadFrequency");
		if(time) {
			var list = {"1":0, "4":1, "8":2, "16":3, "24":4};
			var node = document.getElementById("autoUpload");
			if(node) node.checked = true;
			var temp = document.getElementById("frequency");
			if(temp) temp.style.display = "block";
			var sel = document.getElementById("time");
			sel.selectedIndex = list["" + (time/3600)];
		}
	},

	selectCat: function (id) {
		var t = document.getElementById(id);
		if(!t) {
			var node = document.getElementById("selector-" + id);
			var item = node.parentNode.parentNode.parentNode.id.split("-")[1].trim();
			for(var i in uploadOptions.table[item])
				if(i == id) {
					var temp = document.getElementById("cat-" + id);
					if(temp.checked)
						uploadOptions.table[item][id] = true;
					else
						uploadOptions.table[item][id] = false;
				
					var temp = document.getElementById("total-" + item);
					temp.innerHTML = uploadOptions.getSelected(item) + ' selected';
				
					return;
				}
		} else {
			
			var temp = document.getElementById("cat-" + id);
			if(temp.checked) {
				for(var i in uploadOptions.table[id]) {
					uploadOptions.table[id][i] = true;
					var node = document.getElementById("cat-" + i);
					node.checked = true;
				}
			} else {
				for(var i in uploadOptions.table[id]) {
					uploadOptions.table[id][i] = false;
					var node = document.getElementById("cat-" + i);
					node.checked = false;
				}
			}
					
			var temp = document.getElementById("total-" + id);
			temp.innerHTML = uploadOptions.getSelected(id) + ' selected';
		
			return;
		}
	},
	
	showCat: function (id) {
		var node = document.getElementById("subcat-" + id);
		node.style.display = "block";
		var temp = document.getElementById("selector-" + id);
		temp.innerHTML = '<img src="icons/down.gif" height="18" width="18" onclick="uploadOptions.hideCat(\'' + id + '\');">';
		
		for(var i in uploadOptions.table[id])
			if(uploadOptions.table[id][i]) {
				var node = document.getElementById("cat-" + i);
				node.checked = true;
			}
	},
	
	hideCat: function (id) {
		var node = document.getElementById("subcat-" + id);
		node.style.display = "none";
		var temp = document.getElementById("selector-" + id);
		temp.innerHTML = '<img src="icons/right.gif" height="18" width="18" onclick="uploadOptions.showCat(\'' + id + '\');">';
	},

	getTotal: function (id) {
		if(!uploadOptions.table[id])
			alert(id)
		return Object.keys(uploadOptions.table[id]).length;
	},

	getSelected: function (id) {
		var count = 0;
		for(var i in uploadOptions.table[id])
			if(uploadOptions.table[id][i])
				count++;
		return count;
	},

	addCategory: function (parent, name, id, desc, show) {
		var tr = document.createElement("tr");
		tr.id = id;
		if(show)
			tr.style.display = "block";
		else
			tr.style.display = "none";
		
		var total = uploadOptions.getTotal(id);
		var selected = uploadOptions.getSelected(id);
	
		tr.innerHTML = '<td><span id="selector-' + id + '"><img src="icons/right.gif" height="18" width="18" onclick="uploadOptions.showCat(\'' + id + '\');"></span></td><td><input class="checkbox" id="cat-' + id +'"  onclick="uploadOptions.selectCat(\'' + id + '\');" type="checkbox"></td><td style="width:100%" onclick="uploadOptions.showCat(\'' + id + '\');"><span class="category-name hotspot" onmouseover="uploadOptions.tooltip.show(\'' + desc + '\', false);" onmouseout="uploadOptions.tooltip.hide();">' + name + '</span><span style="font-size:x-small;">' + total + ' metrics</span><span style="font-size:x-small;"> (<span id="total-' + id + '">' + selected+ ' selected</span>)</span></td>';

		parent.appendChild(tr);
		
		var temp = document.createElement("tr");
		temp.setAttribute("id", "subcat-" + id);
		parent.appendChild(temp);
		
		return tr;
	},
	
	addSubCategory: function (parent, name, id, desc, show) {
		
		var temp = document.getElementById("subcat-" + parent.id);
				
		var tr = document.createElement("tr");
		
		if(show)
			temp.style.display = "block";
		else
			temp.style.display = "none";
	
		tr.innerHTML = '<td><span id="selector-' + id + '"><img width="18" height="18" style="visibility:hidden" src="icons/right.gif"></img></span></td><td><input class="checkbox" id="cat-' + id +'"  onclick="uploadOptions.selectCat(\'' + id + '\');" type="checkbox"></td><td style="width:100%" onclick="uploadOptions.showCat(\'' + id + '\');"><span class="category-name hotspot" onmouseover="uploadOptions.tooltip.show(\'' + desc + '\', false);" onmouseout="uploadOptions.tooltip.hide();">' + name + '</span></td>';

		temp.appendChild(tr);

		return temp;
	},
	
	tooltip: function(){
		var id = 'tt';
		var top = 3;
		var left = 3;
		var maxw = 800;
		var speed = 10;
		var timer = 20;
		var endalpha = 95;
		var alpha = 0;
		var tt,t,c,b,h;
		var ie = document.all ? true : false;
		return{
			show:function(v,timed,w){
				if(tt == null){
					tt = document.createElement('div');
					tt.setAttribute('id',id);
					t = document.createElement('div');
					t.setAttribute('id',id + 'top');
					c = document.createElement('div');
					c.setAttribute('id',id + 'cont');
					b = document.createElement('div');
					b.setAttribute('id',id + 'bot');
					tt.appendChild(t);
					tt.appendChild(c);
					tt.appendChild(b);
					document.body.appendChild(tt);
					tt.style.opacity = 0;
					document.onmousemove = this.pos;
				}

				if (timed) {
					document.onmousemove = function(e){
						var u = ie ? event.clientY + document.documentElement.scrollTop : e.pageY;
						var l = ie ? event.clientX + document.documentElement.scrollLeft : e.pageX;
						tt.style.top = (u - h) + 'px';
						tt.style.left = (l + left) + 'px';
						document.onmousemove = null;
					};
				} else {
					document.onmousemove = this.pos;
				}

				tt.style.display = 'block';

				if (document.getElementById(v)) {
					c.innerHTML = document.getElementById(v).innerHTML;
				} else {
					c.innerHTML = v;
				}

				tt.style.width = w ? w + 'px' : 'auto';
				if(!w && ie){
					t.style.display = 'none';
					b.style.display = 'none';
					tt.style.width = tt.offsetWidth;
					t.style.display = 'block';
					b.style.display = 'block';
				}
				if(tt.offsetWidth > maxw) {
					tt.style.width = maxw + 'px'
				}
				h = parseInt(tt.offsetHeight) + top;

				clearInterval(tt.timer);
				tt.timer = setInterval(function(){uploadOptions.tooltip.fade(1)},timer);
			},
			pos:function(e){
				var u = ie ? event.clientY + document.documentElement.scrollTop : e.pageY;
				var l = ie ? event.clientX + document.documentElement.scrollLeft : e.pageX;
				tt.style.top = (u - h) + 'px';
				tt.style.left = (l + left) + 'px';
			},
			fade:function(d){
				var a = alpha;
				if((a != endalpha && d == 1) || (a != 0 && d == -1)){
					var i = speed;
					if(endalpha - a < speed && d == 1){
						i = endalpha - a;
					}else if(alpha < speed && d == -1){
						i = a;
					}
					alpha = a + (i * d);
					tt.style.opacity = alpha * .01;
				}else{
					clearInterval(tt.timer);
				if(d == -1){tt.style.display = 'none'}
				}
			},
			hide:function(){
				clearInterval(tt.timer);
				tt.timer = setInterval(function(){uploadOptions.tooltip.fade(-1)},timer);
			}
		};
	}(),
	
	expandAll: function() {
		for(var i in uploadOptions.table)
			uploadOptions.showCat(i);
	},
	
	collapseAll: function() {
		for(var i in uploadOptions.table)
			uploadOptions.hideCat(i);
	},
	
	selectAll: function() {
		for(var id in uploadOptions.table) {
			var node = document.getElementById("cat-" + id);
			node.checked = true;
			for(var i in uploadOptions.table[id]) {
				uploadOptions.table[id][i] = true;
				var node = document.getElementById("cat-" + i);
				node.checked = true;
			}
			var temp = document.getElementById("total-" + id);
			temp.innerHTML = uploadOptions.getSelected(id) + ' selected';
		}
	},
	
	selectNone: function() {
		for(var id in uploadOptions.table) {
			var node = document.getElementById("cat-" + id);
			node.checked = false;
			for(var i in uploadOptions.table[id]) {
				uploadOptions.table[id][i] = false;
				var node = document.getElementById("cat-" + i);
				node.checked = false;
			}
			var temp = document.getElementById("total-" + id);
			temp.innerHTML = uploadOptions.getSelected(id) + ' selected';
		}
	},
	
	unGrey: function() {
		var node = document.getElementById("autoUpload");
		var temp = document.getElementById("frequency");
		if(node.checked) {
			if(temp) {
				temp.style.display = "block";
				var sel = document.getElementById("time")
				var time = sel.options[sel.selectedIndex].value.split(" ")[0] * 3600;
				var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
				pref.setIntPref("extensions.fathom.dataUploadFrequency", time);
			}
		} else {
			if(temp)
				temp.style.display = "none";
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			pref.setIntPref("extensions.fathom.dataUploadFrequency", 0);
		}
		
	}
};
