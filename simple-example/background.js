// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


var ishelp;
var isStoper;
var timeselected;

chrome.omnibox.onInputStarted.addListener(
	function() {
		ishelp   = false;
		isStoper = false;
		timeselected = 0;
	});

// This event is fired each time the user updates the text in the omnibox,
// as long as the extension's keyword mode is still active.
chrome.omnibox.onInputChanged.addListener(
  function(text, suggest) {
    // console.log('inputChanged: ' + text);
    // suggest([
      // {content: text + " one", description: "the first one"},
      // {content: text + " number two", description: "the second entry"}
    // ]);
	if(text == ""){
		suggest([
			{content: "help", description: "displays the help page"},
			{content: "stoper", description: "triggers a stopwatch"}
		]);
	}else buildHelp(suggest);
  });

function buildHelp(suggest){
	// todo!
}  

// This event is fired with the user accepts the input in the omnibox.

chrome.omnibox.onInputEntered.addListener(
  function(text) {
    if(text == "help"){ishelp=true; navigate(chrome.extension.getURL("help.html"));}
	else if(text == "stoper"){isStoper=true; timeselected=0; navigate(chrome.extension.getURL("TabCount.html"));}
	else {
		timeSetter(text);
		if(timeselected==undefined){navigate(chrome.extension.getURL("error.html"));}
		else{navigate(chrome.extension.getURL("TabCount.html"));}
	}
  });
  
  function navigate(urll) {
	  chrome.tabs.create({
		  url:urll,
		  active:false
	  });
  }
  
  function timeSetter(text){
	  // todo!
	  if(text == undefined || text.length<4) {timeselected=undefined;return;}
	  var arr = text.split(":");
	  var num = arr.length;
	  var value = 0;
	  if(num==3){value = 1000*(parseInt(arr[2]) + 60*(parseInt(arr[1])+ 60*arr[0]));}
	  else if(num==2){value = 1000*(parseInt(arr[1]) + 60*(parseInt(arr[0])));}
	  else value = undefined;
	  timeselected = value;
  }
