window.fathomvis = {}
window.fathomvis.testvis = {}
window.fathomvis.catvis = {}

function sync_top_buttons() {
    function sync_impl(key) {
	for (var i = 0; document.getElementById(key + '_' + i) != null; i++) {
	    if (document.getElementById(key + '_' + i).style.display != 'none') {
		document.getElementById(key + '_all').style.display = 'inline';
		document.getElementById(key + '_all_off').style.display = 'none';
		return;
	    }
	}
	document.getElementById(key + '_all').style.display = 'none';
	document.getElementById(key + '_all_off').style.display = 'inline';
    }

	// commenting them because I'm not sure if I need them
    //sync_impl('exp');
    //sync_impl('note');
    //sync_impl('col');
}

function sync_buttons(cat) {
    var total = window.fathomvis.catvis[cat]['total'];
    var trouble = window.fathomvis.catvis[cat]['trouble'];
    var visible = 0;
    var visible_trouble = 0;

    for (var i = 0; window.fathomvis.testvis[cat + '_' + i] != null; i++) {
	if (document.getElementById('t_data_' + cat + '_' + i).style.display != 'block')
	    continue;

	visible += 1;

	if (window.fathomvis.testvis[cat + '_' + i] == true)
	    visible_trouble += 1;
    }

    function expand(activate) {
	if (activate) {
	    document.getElementById('exp_' + cat).style.display = 'inline';
	    document.getElementById('exp_' + cat + '_off').style.display = 'none';
	} else {
	    document.getElementById('exp_' + cat).style.display = 'none';
	    document.getElementById('exp_' + cat + '_off').style.display = 'inline';
	}
    }

    function note(activate) {
    	return;
	if (activate) {
	    document.getElementById('note_' + cat).style.display = 'inline';
	    document.getElementById('note_' + cat + '_off').style.display = 'none';
	} else {
	    document.getElementById('note_' + cat).style.display = 'none';
	    document.getElementById('note_' + cat + '_off').style.display = 'inline';
	}
    }

    function collapse(activate) {
	if (activate) {
	    document.getElementById('col_' + cat).style.display = 'inline';
	    document.getElementById('col_' + cat + '_off').style.display = 'none';
	} else {
	    document.getElementById('col_' + cat).style.display = 'none';
	    document.getElementById('col_' + cat + '_off').style.display = 'inline';
	}
    }
   
    if (visible == total) {
	expand(false);
	collapse(true);
    } else if (visible == 0) {
	expand(true);
	collapse(false);
    } else {
	expand(true);
	collapse(true);
    }

    if (trouble == 0 || (visible == trouble && visible_trouble == trouble)) {
	note(false);
    } else {
	note(true);
    }
}

function show(key, cat, i, sync) {
    var id = cat + '_' + i;
    document.getElementById(key + '_data_' + id).style.display = 'block';
    document.getElementById(key + '_toggle_' + id).innerHTML = ' - ';
    var el = document.getElementById(key + '_short_' + id);
    if (el != null)
	el.style.display = 'none';
    if (sync) {
	sync_buttons(cat);
	sync_top_buttons();
    }
}

function hide(key, cat, i, sync) {
    var id = cat + '_' + i;
    document.getElementById(key + '_data_' + id).style.display = 'none';
    document.getElementById(key + '_toggle_' + id).innerHTML = '+';
    var el = document.getElementById(key + '_short_' + id);
    if (el != null)
	el.style.display = 'block';
    if (sync) {
	sync_buttons(cat);
	sync_top_buttons();
    }
}

function my_toggle(key, cat, i, sync) {
    if (document.getElementById(key + '_data_' + cat + '_' + i).style.display == 'block')
	hide(key, cat, i);
    else
	show(key, cat, i);
    if (sync) {
	sync_buttons(cat);
	sync_top_buttons();
    }
}

function show_cat(key, cat) {
    for (var i = 0; document.getElementById(key + '_data_' + cat + '_' + i) != null; i++)
	show(key, cat, i);
    sync_buttons(cat);
    sync_top_buttons();
}

function hide_cat(key, cat) {
    for (var i = 0; document.getElementById(key + '_data_' + cat + '_' + i) != null; i++)
	hide(key, cat, i);
    sync_buttons(cat);
    sync_top_buttons();
}

function show_note_cat(key, cat) {
    for (var i = 0; document.getElementById(key + '_data_' + cat + '_' + i) != null; i++) {
	if (window.fathomvis.testvis[cat + '_' + i] == true)
	    show(key, cat, i);
	else
	    hide(key, cat, i);
    }
    sync_buttons(cat);
    sync_top_buttons();
}

function show_all_cat(key) {
    for (var i = 0; document.getElementById(key + '_data_' + i + '_0') != null; i++)
	show_cat(key, i);
}

function hide_all_cat(key) {
    for (var i = 0; document.getElementById(key + '_data_' + i + '_0') != null; i++)
	hide_cat(key, i);
}

function show_all_note_cat(key) {
    for (var i = 0; document.getElementById(key + '_data_' + i + '_0') != null; i++)
	show_note_cat(key, i);
}

function add_test_vis(cat, id, vis) {
    window.fathomvis.testvis[cat + '_' + id] = vis;
    try {
	window.fathomvis.catvis[cat]['total'] += 1;
	if (vis)
	    window.fathomvis.catvis[cat]['trouble'] += 1;
    } catch(e) {
	window.fathomvis.catvis[cat] = {'total': 1, 'trouble': 0}
	if (vis)
	    window.fathomvis.catvis[cat]['trouble'] += 1;	
    }
}

function toggle_generic(elname, txtname, showval, hideval) {
    var el = document.getElementById(elname);
    var txt = document.getElementById(txtname);
    if (el && txt) {
	if(el.style.display == 'block') {
	    el.style.display = 'none';
	    txt.innerHTML = showval;
	} else {
	    el.style.display = 'block';
	    txt.innerHTML = hideval;
	}    
    }
}

function hideAllTests(num) {
	var matches = document.querySelectorAll("div.t-short");
	var re = new RegExp("t_short_" + num);
	for(var i = 0; i < matches.length; i++)
		if(matches[i].id.match(re))
			matches[i].style.display = "none";
}

function showAllTests(num) {
	var matches = document.querySelectorAll("div.t-short");
	var re = new RegExp("t_short_" + num);
	for(var i = 0; i < matches.length; i++)
		if(matches[i].id.match(re))
			matches[i].style.display = "block";
}

function showTest(num, item) {
	var elem = document.getElementById("t_short_" + num + "_" + item);
	elem.style.display = "block";
}

function hideTest(num, item) {
	var elem = document.getElementById("t_short_" + num + "_" + item);
	elem.style.display = "none";
}
