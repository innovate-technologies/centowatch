// Centowatch
// Licensed under GPLv2 - Copyright 2017 The Innovating Group
//      

const child_process = require("child_process");
const util = require("util");

const fetch = require("node-fetch");

const { config } = require("./config.js");

                   
                          
                          
  

const exec                                                                               =
    util.promisify(child_process.execFile);
exports.exec = exec;

//
const shell                                                             =
    util.promisify(child_process.exec);
exports.shell = shell;

async function sendToHub(event        , data         = {}) {
  await fetch(config.hub.base + `/centowatch/${config.hub.token}`, {
    method: "POST",
    timeout: 2000,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data }),
  });
}

function log(message        ) {
  console.error(new Date().toISOString(), message);
  sendToHub("log", { message });
}
exports.log = log;

function logError(error       , message        ) {
  console.error(new Date().toISOString(), message, error);
  sendToHub("error", { error, message });
}
exports.logError = logError;
