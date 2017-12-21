// Centowatch
// Licensed under GPLv2 - Copyright 2017 The Innovating Group
// @flow

const child_process = require("child_process");
const util = require("util");

type ExecResult = {
  stdout: string | Buffer,
  stderr: string | Buffer,
};

const exec: (path: string, args: Array<string>, options: ?Object) => Promise<ExecResult> =
    util.promisify(child_process.execFile);
exports.exec = exec;

//
const shell: (command: string, options: ?Object) => Promise<ExecResult> =
    util.promisify(child_process.exec);
exports.shell = shell;

function log(message: string) {
  console.error(new Date().toISOString(), message);
}
exports.log = log;

function logError(error: Error, message: string) {
  console.error(new Date().toISOString(), message, error);
}
exports.logError = logError;
