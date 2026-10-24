/* Isolated calculation worker. No external requests or player data leave this origin. */
'use strict';
importScripts('gear-planner-data.js?v=5','gear-planner-model.js?v=5','gear-dps-engine.js?v=2','gear-loadout-model.js?v=2');
self.onmessage=function(event){const {id,model,players,encounter,settings}=event.data;try{self.postMessage({id,result:UGGearLoadouts.plan(model,players,encounter,settings)})}catch(error){self.postMessage({id,error:error.message})}};
