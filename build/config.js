// Centowatch
// Licensed under GPLv2 - Copyright 2017 The Innovating Group
//      

const fs = require("fs");

               
        
                 
                  
   
  

const config         = JSON.parse(fs.readFileSync("../config.json").toString());
if (!config.hub || !config.hub.base || !config.hub.token) {
  throw new Error("Invalid config.");
}

exports.config = config;
