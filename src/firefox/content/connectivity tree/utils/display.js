/*----------------------------------------------------------------------------*/

function loadSpinner(num, item) {
	var html = '<div id="floatingBarsG">';
	html += '<div class="blockG" id="rotateG_01"></div>';
	html += '<div class="blockG" id="rotateG_02"></div>';
	html += '<div class="blockG" id="rotateG_03"></div>';
	html += '<div class="blockG" id="rotateG_04"></div>';
	html += '<div class="blockG" id="rotateG_05"></div>';
	html += '<div class="blockG" id="rotateG_06"></div>';
	html += '<div class="blockG" id="rotateG_07"></div>';
	html += '<div class="blockG" id="rotateG_08"></div>';
	html += '</div>';
	
	$("#spinner_" + num + "_" + item).empty();
	$("#spinner_" + num + "_" + item).append(html);
}

function unloadSpinner(num, name, item, text) {
	
	var cls = ".not-ex";
	if(name == "Traceroute") {
		cls = ".warning";
	} else {
		$("#spinner_" + num + "_" + item).empty();
		$("#spinner_" + num + "_" + item).append('<a class="exp-right" href="#" onclick="my_toggle(\'t\', \'' + num + '\', \'' + item + '\', true); return false;" title="Expand/collapse"> + </a>');	
	}
	
	div = $("#t_data_" + num + "_" + item).find(cls);
	if(name == "Traceroute") {
		div.empty();
		div.append("<b>Test description</b>: This test performs a traceroute to an echo server.");
	}
	div.append(text);
}

/*----------------------------------------------------------------------------*/

function getHeading(num, text, i) {
	// generate test heading
	var heading = '<div class="sum0">';
	heading += '<div class="sum-colors">';
	heading += '<div class="sum-col-0"></div>';
	heading += '</div>';
	heading += '<span class="txt-res-hdr">' + text + ' (<a href="#" target="_blank">?</a>) <a id="t_toggle_' + num + '_' + i + '" class="exp-right" href="#" onclick="my_toggle(\'t\', \'' + num + '\', \'' + i + '\', true); return false;" title="Expand/collapse"></a></span>';
	heading += '</div>';
		
	return heading;
}

function displayTest(num, json) {
	var html = '<!-- expanded test content -->';
	for(var i = 0; i < json.length; i++) {
		html += '<div class="t-exp" id="t_data_' + num + '_' + i + '">';
		var item = {
			shortDesc: json[i].desc.short,
			longDesc: json[i].desc.long,
			result: "not-ex"
		}
		html += getHeading(num, item.shortDesc, i);
		html += '<div class="' + item.result + '">' + "<b>Test description</b>: " + item.longDesc + '</div>';
		html += '</div>';

		html += '<!-- end of expanded test content -->';

		html += '<!-- short test content -->';
		html += '<div class="t-short" id="t_short_' + num + '_' + i + '" style="display:none">';
		html += '<div class="sum0">';
		html += '<div class="sum-colors">';
		html += '<div class="sum-col-0" style="height:100.00%"></div>';
		html += '</div>';
		html += '<script language="javascript" type="text/javascript">';
		html += '/* <![CDATA[ */';
		html += 'loadSpinner(' + num + ', ' + i + ');';
		html += '/* ]]> */';
		html += '</script>';		
		html += item.shortDesc + ' (<a href="#" target="_blank">?</a>) <div class="exp-right" id="spinner_' + num + '_' + i + '"></div>';
		html += '</div>';
		html += '</div>';		
		html += '<!-- end of short test content -->';

		html += '<script language="javascript" type="text/javascript">';
		html += '/* <![CDATA[ */';
		html += 'add_test_vis("' + num + '", "' + i + '", false);';
		html += 'hide("t", "' + num + '", "' + i + '", false);';
		html += '/* ]]> */';
		html += '</script>';
	
	}
	
	html += '<script language="javascript" type="text/javascript">';
	html += '/* <![CDATA[ */';
	html += 'document.getElementById("cat_' + num + '").style.display = "inline";';
	html += '/* ]]> */';
	html += '</script>';
	
	return html;
}

function displayCategory(num, title) {
	var html = '<!-- start of category "' + title + '" -->';
	html += '<div class="cat">';
	html += '<div class="txt-section">';
	html += '<div class="title">' + title + '</div>';
	html += '<span id="cat_' + num + '" class="txt-right" style="display:none">';
	html += '<a id="exp_' + num + '" class="exp" href="#" onclick="show_cat(\'t\', \'' + num + '\'); return false;" title="Expand all results" style="display:inline"> + </a>';
	html += '<span id="exp_' + num + '_off" class="exp-off" style="display:none"> + </span>';
	html += '<a id="col_' + num + '" class="exp" href="#" onclick="hide_cat(\'t\', \'' + num + '\'); return false;" title="Collapse all results" style="display:none"> - </a>';
	html += '<span id="col_' + num + '_off" class="exp-off" style="display:inline"> - </span>';
	html += '</span></div>';

	return html;
}

/*----------------------------------------------------------------------------*/

var flags = {};
function visualize(num, title, json) {
	var html = displayCategory(num, title);
	html += displayTest(num, json);
	html += '</div>';
	if(!flags[num])
		flags[num] = true;
	
	/* set the json in fathomStorage */
	var element = document.createElement("AboutFathomElement");
	element.setAttribute("num", num);
	element.setAttribute("json", JSON.stringify(json));
	document.documentElement.appendChild(element);
	/* throw the event */
	var evt = document.createEvent("Events");
	evt.initEvent("UpdateJSON", true, false);
	element.dispatchEvent(evt);
	document.documentElement.removeChild(element);
	
	return html;
}

function updateResults(num, name, item, result, text, log, bool, expdone) {
	var cls = "not-ex";
	if(name != "Traceroute")
		unloadSpinner(num, name, item, "<br></br><b>Result summary</b>: " + text + "<br></br><b>Additional details</b>: " + log);

	var elem = $("#t_short_" + num + "_" + item).closest('.cat').children('.txt-section').children('.title');
	var title = elem.text();
	
	if(name != "Traceroute") {
	if(result == "fail")
		flags[num] &= false;
	else
		flags[num] &= true;
	} else {
		if(expdone && result == "fail")
		flags[num] &= false;
	else
		flags[num] &= true;
	}
	var id = (result == "done" ? 1 : (result == "fail" ? 3 : 2));
	if(name == "Traceroute")
		dump("\n ID = " + id + "\n");
	var div = $("#t_short_" + num + "_" + item).children(".sum0");
	div.attr("class", "sum" + id);
	
	div = $("#t_data_" + num + "_" + item).children(".sum0");
	div.attr("class", "sum" + id);

	div = $("#t_short_" + num + "_" + item).find(".sum-col-0");
	div.attr("class", "sum-col-" + id);
	
	div = $("#t_data_" + num + "_" + item).find(".sum-col-0");
	div.attr("class", "sum-col-" + id);

	if(name == "Traceroute" && bool) {
		if(result == "done" || result == "fail") {
		div = $("#t_short_" + num + "_" + item).children(".sum2");
		div.attr("class", "sum" + id);

		div = $("#t_data_" + num + "_" + item).children(".sum2");
		div.attr("class", "sum" + id);

		div = $("#t_short_" + num + "_" + item).find(".sum-col-2");
		div.attr("class", "sum-col-" + id);

		div = $("#t_data_" + num + "_" + item).find(".sum-col-2");
		div.attr("class", "sum-col-" + id);
	} else if(result == "shortcut") {
		div = $("#t_short_" + num + "_" + item).children(".sum3");
		div.attr("class", "sum" + id);

		div = $("#t_data_" + num + "_" + item).children(".sum3");
		div.attr("class", "sum" + id);

		div = $("#t_short_" + num + "_" + item).find(".sum-col-3");
		div.attr("class", "sum-col-" + id);

		div = $("#t_data_" + num + "_" + item).find(".sum-col-3");
		div.attr("class", "sum-col-" + id);

	}
	}

	div = $("#t_data_" + num + "_" + item).find(".not-ex");	
	if(name == "Traceroute") {
        if(result == "done" && bool && expdone) {
            cls = "success";
            div = $("#t_data_" + num + "_" + item).find(".warning");

            unloadSpinner(num, name, item, "<br></br><b>Result summary</b>: " + text + "<br></br><b>Additional details</b>: " + log);
            $("#spinner_" + num + "_" + item).empty();
            $("#spinner_" + num + "_" + item).append('<a class="exp-right" href="#" onclick="my_toggle(\'t\', \'' + num + '\', \'' + item + '\', true); return false;" title="Expand/collapse"> + </a>');
            removeSpinner(num, item);

        } else if(result == "fail" && bool) {
            cls = "error";
            div = $("#t_data_" + num + "_" + item).find(".not-ex");
		 if(!div.get(0)) {
                div = $("#t_data_" + num + "_" + item).find(".warning");
            	if(!div.get(0))
                	div = $("#t_data_" + num + "_" + item).find(".error");
            }
		 if(expdone) { 
                unloadSpinner(num, name, item, "<br></br><b>Result summary</b>: " + text + "<br></br><b>Additional details</b>: " + log);
                $("#spinner_" + num + "_" + item).empty();
                $("#spinner_" + num + "_" + item).append('<a class="exp-right" href="#" onclick="my_toggle(\'t\', \'' + num + '\', \'' + item + '\', true); return false;" title="Expand/collapse"> + </a>');
                removeSpinner(num, item);
            }
        }
        else {
            cls = "warning";
            if(!div.get(0)) {
                div = $("#t_data_" + num + "_" + item).find(".error");
            	if(!div.get(0))
                	div = $("#t_data_" + num + "_" + item).find(".warning");
            }

		dump("\n1) DIV === " + div.get(0) + "\n");
        }
    } else {
        cls = (result == "done" ? "success" : (result == "fail" ? "error" : "not-ex"));
    }
    div.attr("class", cls);
	
	/*if(flags[num] && id == 1) {
		hideAllTests(num);
		elem.empty();
		elem.append(title).css("color", "#000");
	} else {
		showAllTests(num);
		elem.empty();
		elem.append(title).css("color", "#000");
	}*/
	
	if(viewOnlyProblems) {
		// see only the problems
		if(id == 1) {
			// no problems here
			hideTest(num, item);
			elem.empty();
			elem.append(title).css("color", "#000");
			if(flags[num]) {
				// hide the category as well
				var toplevel_cat = $("#t_short_" + num + "_" + item).closest('.cat');
				toplevel_cat.hide();
			}
		} else {
			showTest(num, item);
			elem.empty();
			elem.append(title).css("color", "#000");
			if(!flags[num]) {
				// hide the category as well
				var toplevel_cat = $("#t_short_" + num + "_" + item).closest('.cat');
				toplevel_cat.show();
			}
		}
	} else {
		// see all the results
		showAllTests(num);
		elem.empty();
		elem.append(title).css("color", "#000");
	}
	
	if(name != "Traceroute")
		removeSpinner(num, item);
}

function removeSpinner(num, item) {
	var obj = $("#spinner_" + num + "_" + item).find('#floatingBarsG');
	obj.html('<div class="exp-right">N/A</div>');
}

function removeSpinners() {
	$('div.sum0').each(function() {
		$(this).find('#floatingBarsG').html('<div class="exp-right">N/A</div>');
	});
}
/*----------------------------------------------------------------------------*/

function refreshDisplay(type) {
	viewOnlyProblems = type;
	
	if(viewOnlyProblems) {
		// show only problems
		var elems = document.getElementsByClassName("cat");
		for(var i = 0; i < elems.length; i++) {
			var count = 0;
			var display = null;
			var items = elems[i].getElementsByClassName("t-exp");
			for(var j = 0; j < items.length; j++) {
				// hide all expanded text
				items[j].style.display = "none";
				
				var errors = items[j].getElementsByClassName("error");
				if(errors.length) {
					count++;
					if(items[j] && items[j].nextElementSibling)
						display = "block";
				} else {
					// hide t-short
					if(items[j] && items[j].nextElementSibling)
						display = "none";
				}
				if(display && items[j] && items[j].nextElementSibling)
					items[j].nextElementSibling.style.display = display;
			}
			if(count)
				elems[i].style.display = "block";
			else
				elems[i].style.display = "none";
				
			// TODO: fix the expand/collapse buttons
			// find the noe with title attribute as 
			var el = elems[i].getElementsByClassName("exp");
			for(var p = 0; p < el.length; p++) {
				var title = el[p].getAttribute("title");
				if(title == "Expand all results") {
					el[p].style.display = "inline";
					el[p].nextElementSibling.style.display = "none";
				} else if(title == "Collapse all results") {
					el[p].style.display = "none";
					el[p].nextElementSibling.style.display = "inline";
				}
			}
		}
	} else {
		// show all
		var elems = document.getElementsByClassName("cat");
		for(var i = 0; i < elems.length; i++) {
			elems[i].style.display = "block";
			// hide all expanded text
			var items = elems[i].getElementsByClassName("t-exp");
		
			for(var j = 0; j < items.length; j++)
				items[j].style.display = "none";
			// show all short text
			var items = elems[i].getElementsByClassName("t-short");
		
			for(var j = 0; j < items.length; j++)
				items[j].style.display = "block";
				
			// TODO: fix the expand/collapse buttons
			// find the noe with title attribute as 
			var el = elems[i].getElementsByClassName("exp");
			for(var p = 0; p < el.length; p++) {
				var title = el[p].getAttribute("title");
				if(title == "Expand all results") {
					el[p].style.display = "inline";
					el[p].nextElementSibling.style.display = "none";
				} else if(title == "Collapse all results") {
					el[p].style.display = "none";
					el[p].nextElementSibling.style.display = "inline";
				}
			}
		}
	}	
}
