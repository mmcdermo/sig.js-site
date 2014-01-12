window.wg_instances = 0; 
function wgSig(s){
    var sig = s;
    var instance = wg_instances++;
    if(sig === undefined){ 
	if(window.sig === undefined) throw "wgSig requires jsSig";
	sig = window.sig;
    }

    /** Bindings are signals that depend on the output of elements.
      * ex) elemSig.clicked(), elemSig.visible(), etc
      * Since elements are often rerendered and rebound, we keep 
      *  track of connected signals so we can reconnect them to the new
      *  input signals.
     **/ 
    var bindings = {};

    var defBindings = 
	{ clicked : false, mouseover: false, val : undefined }

    function _registerBinding(guid, name){ 
	if(bindings[guid] === undefined) bindings[guid] = {};
	if(bindings[guid][name] === undefined){
	    var r = sig.lift(function(x){ return x; }).def(defBindings[name]);
	    sig.__.addSFN(r);
	    bindings[guid][name] = r;
	    return r; 
	}
	else return bindings[guid][name];
    }

    // The default WidgetSpec
    function defaultWS(){
	return {
	    type : "WidgetSpec",
	    classes : [],
	    id: "",
	    css: {},
	    props: {
		html : undefined,
		val : "",
		css : {}
	    },
	    gen: function(){ return "<div></div>"; }
	}
    }

   
    function sel(elem, prefix){ 
	if(prefix === undefined) prefix = "#";
	return prefix+"wgElem_"+elem.guid; 
    }

    function elemChanged(z){ return true; } // TODO
    
    function _updateChildren(elem, force){
	//Do one pass on the old data to get a hashtable of all 
	// old elements present.
	var oldIdxs = {};
	if(elem.oldChildren !== undefined){
	    for(var i = 0; i < elem.oldChildren.length; i++){
		if(elem.oldChildren[i] !== undefined){
		    oldIdxs[elem.oldChildren[i].guid] = i;
		}
	    }
	}
	//Iterate over new children, updating old ones as necessary.
	for(var i = 0; i < elem.children.length; i++){
	    var ch = elem.children[i];
	    if(ch === undefined) continue; //TODO
	    //Possibly update element
	    if(oldIdxs[ch.guid] !== undefined && force === false){
		if(elem.oldChildren === undefined
		   || elemChanged(ch, elem.oldChildren[oldIdxs[ch.guid]]) 
		   ){
		    _render(ch, sel(elem), null, sel(elem), true);
		}
		delete oldIdxs[ch.guid]; //will use this for deletion later
	    }
	    //Append a new element
	    else {
		_render(ch, sel(elem), null, null, false);
	    }
	}
	//Remove any old elements we didn't encounter in the new list.
	for(idx in oldIdxs){
	    jQuery(sel(elem)).remove(sel(elem.oldChildren[oldIdxs[idx]]));
	}
    }

    //_changeCSS : Element -> Element -> m ()
    function _changeCSS(elem, oldElem){
	if(elem.spec.css === {} && oldElem.spec.css === {}) return; 
	var jq = jQuery(sel(elem));
	if(!oldElem){
	    for(k in elem.spec.css){ 
		jq.css(k, elem.spec.css[k]); 
	    }
	}
	else {
	    for(k in elem.spec.css){
		if(oldElem.spec.css[k] !== elem.spec.css[k]){
		    jq.css(k, elem.spec.css[k]);
		}
	    }
	}
    }

    //_bind : Signal Element -> m ()
    // TODO: rebind elem output signals that only became 
    //   depended upon after the most recent _bind. 
    function _bind(elem){
	for(binding in bindings[elem.guid]){
	    if(elem.bind[binding] === undefined) throw "Binding "+binding+" is not provided for element "+elem.guid; 
	    //sig.__.addSFN(elem.bind[binding]);
	    sig.__.reconnect(elem.bind[binding](sel(elem)), bindings[elem.guid][binding]);
	}
    }

    //_render : Element -> Selector ->
    //          Element -> Selector ->
    //          Bool -> Bool -> m ()
    function _render(elem, selector, oldElem, oldSel, replace, firstRender){
	if(selector != oldSel) jQuery(sel(elem)).remove();
	if(elem.genChanged === undefined){
	    console.log("BREAKPOINT");
	}
	if(elem.genChanged === true || selector != oldSel || firstRender){
	    var g = generate(elem);
	    if(selector != oldSel || firstRender){
		jQuery(g).attr('id', sel(elem, "")).addClass("wg_widget").appendTo(jQuery(selector));
		_bind(elem);
	    }
	    else {
		var gp = jQuery(g).html(); //extract inner contents
		var se = jQuery(sel(elem));
		var children = se.children(".wg_widget").remove();
		se.html(gp); 
		se.append(children);
	    }

	    _updateChildren(elem, true);

	    _changeCSS(elem, oldElem);
	}
	else {
	    _updateChildren(elem, false);
	    if(elem.cssChanged) _changeCSS(elem, oldElem);
	}
    }

    //render : Signal Element -> Signal Selector -> m ()
    function render(elem, sel){
	var rendered = false; //may want to use FRP construct rather than closure
	                      // use this to force a re-render the first time.
	function wrap(orig, loop){
	    var z = _render(orig[0], orig[1], loop[0], loop[1], false, !rendered);
	    rendered = true;
	}
	var orig = sig.combine([elem, sel]).lift(function(x){ return x; });
	var r = sig.compose2(orig, orig.loop(), sig.lift(wrap));
	return r; 
    }
    
    //generate : Element -> HTML
    function generate(elem){
	if(elem.spec === undefined){
	    console.log("Breakpoint!");
	}
	return elem.spec.gen();
    }

    function defaultBindings(guid){
	return {
	    "clicked" : function(sel){
		return sig.__.asyncInputSig(function(n){
		    sig.__.asyncInput(n, false);
		    jQuery(sel).mousedown(function(e){
			sig.__.asyncInput(n, true);
		    });
		    jQuery(document).mouseup(function(e){ 
			sig.__.asyncInput(n, false);
		    });
		});
	    }
	    ,"mouseover" : function(sel){
		return sig.__.asyncInputSig(function(n){
		    sig.__.asyncInput(n, false);
		    jQuery(sel).mouseover(function(e){
			sig.__.asyncInput(n, true);
		    });
		    jQuery(sel).mouseleave(function(e){ 
			sig.__.asyncInput(n, false);
		    });
		});
	    }
	    ,"val" : function(sel){
		return sig.__.asyncInputSig(function(n){
		    sig.__.asyncInput(n, jQuery(sel).val());
		    jQuery(sel).change(function(e){
			sig.__.asyncInput(n, jQuery(sel).val());
		    });
		});
	    }
	}
    }

    //_elem : WidgetSpec -> [Element] -> Element
    function _elem(guid, WS, children, oldWS, oldChildren){
	//At least one of the following has happened:
	//  - The generated content has changed
	//  - The associated CSS has changed
	//  - The element's children have changed
	
	//Test whether the generated content has changed
	if(WS === undefined){ console.log("WS undefined"); return; }
	var genChanged = true;
	if(oldWS !== undefined && oldWS.gen !== undefined){
	    var g = WS.gen(oldWS);
	    var oldg = oldWS.gen(); //TODO: need oldoldWS
	    genChanged = g !== oldg
	}
	//Test whether the CSS properties for this widget have changed
	var cssChanged = true;
	if(WS.css !== undefined && oldWS !== undefined){
	    //This is surprisingly the fastest way to compare objects for equality
	    cssChanged = JSON.stringify(WS.css) !== JSON.stringify(oldWS.css) 
	}
	return {
	    type : 'Element',
	    guid : guid,
	    genChanged : genChanged,
	    cssChanged : cssChanged,
	    children : children,
	    oldChildren : oldChildren,
	    spec : WS,
	    bind : defaultBindings()
	}
    }

    function typeAssert(type, obj, caller){
	caller = caller || "Unknown function";
	if(typeof(obj) !== type && obj.type !== type)
	    throw caller + "requires an argument of type "+type;
	return true; 
    }

    //elem : Signal WidgetSpec -> [Signal Element] -> Signal Element
    function elem(sWS, chld){
	var sChildren; 
	if(chld === undefined) sChildren = sig.constant([]);
	else if(chld[0] !== undefined){
	    console.log("COMBINE");
	    sChildren = sig.combine(chld);
	}
	else { console.log("ELEM: ", chld); sChildren = chld; }

	function wrap(orig, loop){
	    typeAssert("WidgetSpec", orig[0], "wg.elem");
	    typeAssert("object", orig[1], "wg.elem");
	    return _elem(instance+"_"+this.guid, orig[0], orig[1], loop[0], loop[1]);
	}
	var orig = sig.combine([sWS, sChildren]);
	return sig.compose2(orig, orig.loop(), sig.lift(wrap));
    }
    sig.__.SFN.prototype.elem = function(ch){ return elem(this, ch); }
    

    //clicked : Signal Element -> Signal Bool
    //mouseover : Signal Element -> Signal Bool
    var simpleOutputs = ["clicked", "mouseover", "val"];
    simpleOutputs.forEach(function(name){
	sig.__.SFN.prototype[name] = function(){
	    return this.lift(function(e){ 
		return _registerBinding(e.guid, name); }).join(); 
	}
    });

    //mappend for defaults
    // merge : {} -> {} -> {}
    function merge(o1, o2){
	if(o1 === undefined){ o1 = {}; }
	if(typeof(o1) !== "object" || typeof(o2) !== "object") 
	    throw "mplus must be passed two objects";
	var res = {};
	for(k in o1){ res[k] = o1[k];}
	for(k in o2){
	    if(typeof(o2[k]) === "object") res[k] = mplus(o1[k], o2[k]);
	    else res[k] = o2[k];
	}
	return res;
    }
    sig.__.SFN.prototype.merge = function(objsig){ 
	return sig.compose2(this, objsig, sig.lift(merge));
    };

    function spec(){
	return sig.constant(defaultWS()); 
    }

    sig.__.SFN.prototype.css = function(objSig){ 
	function cssMerge(ws, newCSS){
	    typeAssert("WidgetSpec", ws, "wg.css");
	    typeAssert("object", newCSS, "wg.css");
	    ws.css = merge(ws.css, newCSS);
	    return ws; 
	}
	return sig.compose2(this, objSig, sig.lift(cssMerge));
    };


    sig.__.SFN.prototype.dynGen = function(genSig){ 
	function genMerge(ws, newGen){
	    typeAssert("WidgetSpec", ws, "wg.gen");
	    typeAssert("function", newGen, "wg.gen");
	    ws.gen = newGen;
	    return ws; 
	}
	return sig.compose2(this, genSig, sig.lift(genMerge));
    }; 

    sig.__.SFN.prototype.gen = function(genSig){ 
	var g = genSig.lift(function(c){ return function(x){ return c } });
	return this.dynGen(g); 
    }; 

    function stringSpec(str){
	var w = defaultWS();
	w.gen = function(spec){ return str; }
	return sig.constant(w);
    }
   
    
    return {
	defaultWS : defaultWS,
	spec : spec,
	stringSpec : stringSpec,
	elem : elem,
	render : render,
	merge : merge
    }

}

