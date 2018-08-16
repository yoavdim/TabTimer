/*
 *  TabScript.js
 *
 *  Copyright (C) 2018  Yoav Dim, All Rights Reserved.
 *
 */






		// TODO: change between clock & timer during frozen values


		var Cycle_Interval = 1000; // !!! CONST !!! Do Not Change That !!!
		var Clock_Cycle_Interval = 1000;

		const play_img = "./icons/ic_play.svg";
		const pause_img = "./icons/ic_pause.svg";

		var original_time      = new Date();

		var original_clock	   = false; // true = show the time, false = act normally // TODO: from server

		var original_value     = undefined;
		var original_direction = undefined; // true = stoper = count_up ; false = count_down;
		var original_ringer    = undefined;
		var original_paused    = undefined;
		var original_am_i_extension = undefined;
		var original_am_i_search_query = undefined;

		var ring_aloud = true; // alert when time is over
		var was_alerted = false;

		if( window.chrome != undefined && chrome.extension != undefined ) {
			original_value     = chrome.extension.getBackgroundPage().timeselected;
			original_direction = chrome.extension.getBackgroundPage().isStoper;
			original_ringer    = false; //TODO: from server
			original_paused    = false; //TODO: from server
			original_am_i_extension = true;
			original_am_i_search_query = false;
		} else { //not extension
			original_value     = 0;
			original_direction = true;  // count_up by default
			original_ringer    = true; //TODO: from server
			original_paused    = true; //TODO: from server
			original_am_i_extension = false;
			original_am_i_search_query = false;
			let url_pass_by = fetch_query();
			if(url_pass_by != undefined) {
				original_am_i_search_query = true;
				init_by_query(url_pass_by);
			}
		}

		function init_by_query(obj) {
			if(obj["val"] != undefined){
				if( ["stoper", "stopper", "timer", "count"].includes(obj["val"])) {
					original_value = 0;
					original_direction = true;
					original_paused = false;
					return;
				} else if(["clock", "time"].includes(obj["val"])) {
					original_value = 0;
					original_direction = true;
					original_paused = true;
					original_clock = true;
					return;
				} else {
					original_value = deformat_time(obj["val"]);
					if(original_value == undefined || original_value == NaN) {
						console.warn("warnning: the query passed value is ilegal, defaulting to zero.");
						original_value = 0;
					}
					if(obj["dir"] != undefined){
						original_direction = (obj["dir"] == "up");
					} else {
						original_direction = (original_value <= 0);
					}
					original_paused = original_direction;
				}
			}
			/*for(attr in obj) {
				if(attr == "val"){
					original_value = deformat_time(obj["val"]);
					if(original_value == undefined || original_value == NaN) {
						console.warn("warnning: the query passed value is ilegal, defaulting to zero.");
						original_value = 0;
					}
				} else if(attr == "dir"){
					original_direction = (obj["dir"] == "up");
					// TODO: ??
				}
			}*/
		}

		/**
				TODO: put an end to the chaos of:
						myFlip myTimer subTime myUpdate startInterval stopInterval

				TODO:
					revise the ring_aloud mechanisem
		*/

		// last set-up
		var setup_time         = original_time;
		var setup_direction    = original_direction;
		var setup_value        = original_value;

		// last flip
		var start_time         = setup_time;
		var start_direction    = setup_direction;
		var start_value        = setup_value;

		// frozed value: unfreezing or flipping will not override this
		var frozed_value	   = NaN;
		var frozed_time		   = original_time;

		// current
		var present_clock = original_clock;

		var last_time          = start_time; // aka present_time
		var present_value      = start_value;
		var present_direction  = start_direction;

		var present_ringer     = original_ringer;
		var present_paused     = original_paused;
		var present_frozen	   = false; //lighter interface than the rest

		var semi_original_time = original_time; //for full-reset
		var semi_semi_original_time = semi_original_time; // for reset

		function isterminated(){ return (! present_direction ) && ( present_ringer  ); } // The termination option for countDown is enabled.
		function isover()      { return (  isterminated() ) && ( present_value <= 0 ); } // The countDown was over.
		function ispaused()    { return  present_paused; }                               // no counting
		//function isactive()    { return (! isover() ) && (! ispaused() ); }
		function isBoth()      { return (  isover() ) && (  ispaused() ); }				 //
		function isNeedTermination() { return isover() && ! ispaused(); }

		function getStatus(){   if(isactive()){return 'running...';}
								else if(isBoth()){return 'paused finished.';}
								else if(ispaused()){return 'paused.';}
								else{return 'finished!';}
		}

		function isTimeSetAllowed() {
			return ispaused();
		}


		checkboxes_sync();
		document.getElementById("z").addEventListener("click",startnew);
		document.getElementById("f").addEventListener("click",change_direction);
		document.getElementById("ag").addEventListener("click",small_reset);
		document.getElementById("res").addEventListener("click",medium_reset);
		document.getElementById("winter_res").addEventListener("click",winter_reset);
		document.getElementById("full_res").addEventListener("click",large_reset);
		document.getElementById("sw_rng").addEventListener("click",change_ringer);
		document.getElementById("frz").addEventListener("click",changeFrozen);
		document.getElementById("noise").addEventListener("click",changeRingAloud);
		document.getElementById("set-setup").addEventListener("click",try_set_up);
		document.getElementById("add-setup").addEventListener("click",try_add_up);
		document.getElementById("sub-setup").addEventListener("click",try_sub_up);
		document.getElementById("clk").addEventListener("click",change_timer_or_clock);
		document.getElementById("log-add-btn").addEventListener("click",logtime);
		document.getElementById("log-clear-btn").addEventListener("click",clearlogs);
		document.getElementById("log-pop-btn").addEventListener("click",logpop);
		document.getElementById("log-lap-btn").addEventListener("click",loglap);


		//enter
		document.getElementById("set-box").addEventListener("keypress",onEnterPress);
		function onEnterPress(event){
			if (event.keyCode == 13) {
				try_set_up();
			}
		}
		//big one
		document.getElementById("big-button").addEventListener("click",myFlip);
		big_push_update();
		document.getElementById("big-button").focus();


		//Run:
		var present_interval = false; // true if the cycle is active, !!! do not change manualy !!!
		var myVar = undefined;
		myUpdate();

		// ///////////////////////////////////////////
		//Run Clock:
		var myClockVar = undefined;
		function isClockActive() { return present_clock && ! present_frozen ; }
		function clockLoop(){
			clearTimeout(myClockVar); // unnecessery ???
			if(isClockActive()) {
				myClockVar = setTimeout(clockLoop, Clock_Cycle_Interval);
			}
			freezableGuiUpdate();
		}

		clockLoop(); // activate.
		// ///////////////////////////////////////////
		// ///////////////////////////////////////////


		function myTimer() {
			if( ispaused() ){ myUpdate(); return; }
			subTime();
			myUpdate();
		}

		function subTime(){
			var d = new Date();
			var z = d.getTime() - last_time.getTime();
			last_time = d;
			if(present_direction){
				present_value = present_value + z;
			}else{
				present_value = present_value - z;
				if(present_ringer&& present_value<0){present_value=0;}
			}
		}

		// Types of updates: I had this wrong

		// * myUpdate: update present
		// * update start & semi-original
		// * update ringer
		// * update original -onload

		function myUpdate(){
			terminationUpdate();
			guiUpdate();
			intervalUpdate();
		}
		function terminationUpdate() {
			if(isNeedTermination()) {
				pause();
				if(ring_aloud & ! was_alerted) {
					beep();
				}
			} else was_alerted = false;
		}

		var beep_aud = new Audio("./A-Tone.wav");
		function beep(){
			beep_aud.play().then( ()=>{alert("Time's up!");},()=>{});
			was_alerted = true;
		}

		function changeRingAloud() {
			ring_aloud = ! document.getElementById("noise").checked;
			was_alerted = false;
		}
		function intervalUpdate() {
			if( ispaused() ){
				stopInterval();
			} else {
				startInterval();
			}
		}
		function guiUpdate() {
			freezableGuiUpdate();
			//big_push_update();
			//checkboxes_sync();
		}
		function checkboxes_sync(){
			document.getElementById("sw_rng").checked = present_ringer;
			document.getElementById("noise").checked = ! ring_aloud;
		}
		function big_push_update() {
			if(ispaused()){
				document.getElementById("pause-svg").setAttribute("style","display:none;");
				document.getElementById("play-svg").setAttribute("style","");
				//document.getElementById("big_push_img").src=play_img;
				//document.getElementById("big_push").setAttribute("icon_label","play ");
				//document.getElementById("big_push").innerHTML = "play";
			}else{
				document.getElementById("pause-svg").setAttribute("style","");
				document.getElementById("play-svg").setAttribute("style","display:none;");
				//document.getElementById("big_push_img").src=pause_img;
				//document.getElementById("big_push").setAttribute("icon_label","pause");
				//document.getElementById("big_push").innerHTML = "pause";
			}
		}
		function freezableGuiUpdate() {
			if( (!present_clock) && ! present_frozen ) {
				bruteForceGuiTimeUpdate(present_value);
			} else if( (!present_clock) && present_frozen) {
				bruteForceGuiTimeUpdate(frozed_value);
			} else { /*if( present_clock )*/
				bruteForceClockGuiUpdate(present_frozen);
			}
		}
		function bruteForceGuiTimeUpdate(val) {
				document.getElementById("inner-display").innerHTML = format_time(val);
				document.title = format_time_title(val);
		}
		function bruteForceClockGuiUpdate(ice = false){
			function checkTime(i) {
				if (i < 10) {i = "0" + i};  // add zero in front of numbers < 10
					return i;
			}

			if(ice){
				var today = frozed_time;
			}else{
				var today = new Date();
			}
			var h = today.getHours();
			var m = today.getMinutes();
			var s = today.getSeconds();
			m = checkTime(m);
			s = checkTime(s);
			document.getElementById('inner-display').innerHTML = h + ":" + m + ":" + s;
			document.title =  h + ":" + m + ":" + s;
		}


		function changeFrozen() {
			present_frozen = ! present_frozen;
			if(present_frozen) {
				frozed_value = present_value;
				frozed_time = new Date();
				freezableGuiUpdate();
			} else {
				freezableGuiUpdate();
				clockLoop();
			}
		}


		// ----
		function change_timer_or_clock() {
			present_clock = ! present_clock;
			if(present_clock) {
				freezableGuiUpdate();
				clockLoop();
			} else {
				myUpdate();
			}
		}
		function change2time() {
			if(present_clock){
				present_clock = false;
				myUpdate();
			}
		}
		function change2clock() {
			if(!present_clock){
				present_clock = true;
				clockLoop();
			}
		}
		// ----

		function isInterval(){return present_interval;}
		function startInterval(){
			if(isInterval()){
				return;
			}else{
				last_time = new Date();
				present_interval = true;
				myVar = setInterval(myTimer ,Cycle_Interval);
				myTimer();
				return;
			}
		}
		function stopInterval(){
			if(isInterval()){
				present_interval = false;
				clearInterval(myVar);
				subTime();
				return;
			}else{
				return;
			}
		}

		function myFlip(){ // pause/play
			if(ispaused() ) resume();
			else pause();
		}

		function resume(){
			if(ispaused() && ! isover()) {
				present_paused = false;
				big_push_update();
				startInterval();
			} else terminationUpdate();
		}
		function pause(){
			if( ! ispaused() ) {
				present_paused = true;
				stopInterval();
				big_push_update();
			}
		}

		function lockTime( callback ) {
			if( ! ispaused() ) {
				pause();
				callback();
				resume();
			} else callback();
		}

		function startnew(){
			do_setup(0);
		}

		function change_direction(){
			lockTime( function(){
				last_time = new Date();
				present_direction = ! present_direction;
				set_start_as_present();
			});
			myUpdate();
		}
		function set_start_as_present() {
			start_value = present_value;
			start_direction = present_direction;
			start_time = last_time;
		}

		function small_reset(){ // last flip : again
			lockTime( function(){
				present_direction = start_direction;
				present_value = start_value;
				last_time = new Date();
			});
			myUpdate();
		}
		function winter_reset(){ // set the value to when it was frozen
			lockTime( function(){
				if(frozed_value != NaN) {
					present_value = frozed_value;
					last_time = new Date();
				}
				else alert("no value to restore");
			});
			myUpdate();
		}

		function try_set_up() {
			try_generic_set_up(get_setup_data);
		}
		function try_add_up() {
			try_generic_set_up(get_addup_data);
		}
		function try_sub_up() {
			try_generic_set_up(get_subup_data);
		}
		function try_generic_set_up(getData) {
			if(! isTimeSetAllowed() ) {
				alert("please pause before setting up the time.");
				return;
			}
			var time = getData();
			if( time == undefined || time == NaN ) {
				alert("please enter a valid time.");
				return;
			}
			do_setup(time);
		}

		function get_setup_data() {
			return deformat_time(document.getElementById("set-box").value);
		}
		function get_addup_data() {
			return present_value + get_setup_data();
		}
		function get_subup_data() {
			return present_value - get_setup_data();
		}

		function do_setup(time) {
			setup_value = time;
			setup_direction = present_direction;
			medium_reset();
		}

		function medium_reset(){ // last set-up : reset
			lockTime( function(){
				start_direction    = setup_direction;
				start_value        = setup_value;
				present_value      = start_value;
				present_direction  = start_direction;

				present_direction = start_direction;
				present_value = start_value;
				semi_semi_original_time = new Date();
				start_time = semi_semi_original_time;
				last_time = start_time;

				frozed_value = present_value;
			});
			myUpdate();
		}

		function large_reset(){
			lockTime( function(){
				setup_direction    = original_direction;
				start_direction	   = setup_direction;
				setup_value        = original_value;
				start_value        = setup_value;
				present_value      = start_value;
				present_direction  = start_direction;

				present_ringer     = original_ringer;
				present_paused     = original_paused;

				present_direction = start_direction;
				present_value = start_value;
				frozed_value = NaN;
				semi_original_time = new Date();
				semi_semi_original_time = semi_original_time;
				setup_time = semi_semi_original_time;
				start_time = setup_time;
				last_time = start_time;
			});
			myUpdate();
		}

		function change_ringer(){
			present_ringer = document.getElementById('sw_rng').checked;
			terminationUpdate();
		}

		function fetch_query(){ // return an object that its fields are the passed key-value paits in the url
			var task = location.href;
			if(task == undefined)
				return undefined;
			var qmark = task.indexOf("?");
			if(qmark == NaN || qmark < 0 || task.length <= qmark+1)
				return undefined;
			task = task.slice(qmark + 1);
			var hashmark = task.indexOf("#");
			if(hashmark >= 0){
				if(task.length <= hashmark+1)
					return undefined;
				task = task.substr(0, hashmark);
			}
			var pairs = task.split("&");
			var result ={};
			for (i = 0; i < pairs.length; i++) {
				let two = pairs[i].split("=");
				if(two.length != 2)
					return undefined;
				let key = decodeURIComponent(two[0]);
				let val = decodeURIComponent(two[1]);
				try{
					result[key] = val;
				} catch(e){
					alert("error: ilegal url. ignoring url parameters.");
					return undefined;
				}
			}
			return result;
		}


		function deformat_time(text){ // return milisec : can be improved
			if(text == undefined || text == "" ) {console.warn("invalid input, assume zero."); return 0;}
			var neg = (text.charAt(0) == '-');
			if(neg){text = text.substring(1);}
			var arr = text.split(":");
			var num = arr.length;
			var value = 0;
			if(num==3){value = 1000*(parseInt(arr[2]) + 60*(parseInt(arr[1])+ 60*arr[0]));}
			else if(num==2){value = 1000*(parseInt(arr[1]) + 60*(parseInt(arr[0])));}
			else if(num==1){value = 1000*(parseInt(arr[0]));}
			else value = NaN;
			return neg ? -value : value;
		}


		function format_time_title(milisec) {
			return format_time(milisec);
		}
		function format_time(milisec){
			milisec = parseInt(milisec);
			var minus = "";
			if(milisec < 0){minus = "-";}
			milisec = Math.abs(milisec);

			var one_uni = 1000;

			var one_s = 1;
			var one_m = 60*one_s;
			var one_h = 60*one_m;
			var max_h = 24;//not included
			//var one_d = 24*one_h;

			var unisec = Math.round(milisec/one_uni);
			if(present_ringer && unisec<0){unisec=0;}
			if(unisec == 0){minus = "";} // small negatives like -0.05 can be rounded to 0

			var hours = Math.floor(unisec/one_h);
			if(hours >= max_h){alert("time overflow");return "error";} //no support for days
			unisec = unisec - hours*one_h;
			var minutes = Math.floor(unisec/one_m);
			unisec = unisec - minutes*one_m;
			var seconds = Math.floor(unisec/one_s);
			unisec = unisec - seconds*one_s; //need to be zero

			//hours   = hours.toString(); // we will make a more elegant view of the hours
			minutes = minutes.toString();
			seconds = seconds.toString();

			//if(hours.length == 1) hours = "0" + hours; // we will make a more elegant view of the hours
			if(minutes.length == 1) minutes = "0" + minutes;
			if(seconds.length == 1) seconds = "0" + seconds;

			if(hours == 0){return minus + minutes + ":" + seconds;}
			else { return minus + hours.toString() + ":" + minutes + ":" + seconds; }
		}










		////////////////////////////////////////
		// list:    //TODO: per-item buttons
		////////////////////////////////////////

		function print_parents(node){ // for debugging;
			console.log("My Heritage:\n");
			while(node){
				let tag = node.tagName;
				let id = node.getAttribute("id");
				let cls = node.getAttribute("class");
				let nm = node.getAttribute("name");
				let str = ""+ tag + ":  ";
				if(id) str = str +" id=\""+id+"\"";
				if(nm) str = str +" name=\""+nm+"\"";
				if(cls) str = str +" class=\""+cls+"\"";
				str+=" ;\n";
				console.log(str);
				node = node.parentNode;
			}
			console.log(" - END - \n");
		}

		function logtime(){
			//if(ico == undefined) ico = "label";
			let cln = document.getElementById("list_template").content.cloneNode(true);
			let tm = (new Date()).toTimeString();
			let vl = present_value;

			cln.querySelector(".log-value").innerHTML = format_time(vl);
			cln.querySelector(".log-value").setAttribute("value",vl);
			cln.querySelector(".log-time").innerHTML = tm;
			//cln.icon=ico;
			document.getElementById("log-table").prepend(cln);
			let tot = document.getElementById("log-total").querySelector(".log-value");
			tot.setAttribute("value", vl + Number(tot.getAttribute("value")));
			tot.innerHTML = format_time(Number(tot.getAttribute("value")));
			let lst = document.getElementById("log-last").querySelector(".log-value");
			lst.setAttribute("value", vl);
			lst.innerHTML = format_time(vl);
			let cnt = document.getElementById("log-count").querySelector(".log-value");
			cnt.setAttribute("value", 1 + Number(cnt.getAttribute("value")));
			cnt.innerHTML = cnt.getAttribute("value");
			return cln;
		}
		function loglap(){
			logtime();
			startnew(); // set zero
		}
		function logpop(){
			let head = document.getElementById("log-table").querySelector("tr:first-of-type()");
			if(head){
				do_setup(head.querySelector(".log-value").getAttribute("value"));
				logremove(head);
			} else {
				alert("Oops.. The log is empty.");
			}
		}
		function logremove(item) {
			if(!item){alert("Oops.. Something went wrong."); return;}
			let val = Number(item.querySelector(".log-entry-value").getAttribute("value"));
			let head = document.getElementById("log-table").querySelector("tr:first-of-type()");
			if(item.isSameNode(head)) { // first element
				let // TODO continue function
			}
		}
		function clearlogs(){
			document.getElementById("log-table").innerHTML = "";
			let tot = document.getElementById("log-total").querySelector(".log-value");
			tot.setAttribute("value", 0);
			tot.innerHTML = format_time(0);
			let lst = document.getElementById("log-last").querySelector(".log-value");
			lst.setAttribute("value", NaN);
			lst.innerHTML = "none";
			let cnt = document.getElementById("log-count").querySelector(".log-value");
			cnt.innerHTML = "0";
		}
