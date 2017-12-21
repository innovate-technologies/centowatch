// Centowatch
// Licensed under GPLv2 - Copyright 2017 The Innovating Group
// @flow

const fs = require("fs");

type Config = {
  hub: {
    base: string,
    token: string,
  }
};

const config: Config = JSON.parse(fs.readFileSync(__dirname + "/../config.json").toString());
if (!config.hub || !config.hub.base || !config.hub.token) {
  throw new Error("Invalid config.");
}

exports.config = config;
