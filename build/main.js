// Centowatch
// Licensed under GPLv2 - Copyright 2017 The Innovating Group
//      

const { exec, log, logError, shell } = require("./util");

// Check if Centova services are running: if not, restart them
                                                   
async function ensureServicesRunning(aggressive      )                         {
  try {
    const ret = await exec("/usr/local/centovacast/centovacast", ["status"], { timeout: 60000 });
    const statuses                = ret.stdout.toString().trim().split("\n");
    const allStarted       = statuses.every((status) => status.includes("running (pid"));
    if (allStarted) {
      return "ok";
    }
  } catch (error) {
    logError(error, "Failed to check service status");
    return "failed";
  }

  try {
    if (aggressive) {
      log("⚠ Restarting services more aggressively (killing bad processes first)");
      await killBrokenServices();
    } else {
      log("⚠ Restarting services");
    }
    await exec("/usr/local/centovacast/centovacast", ["start"], { timeout: 60000 });
    return "restarted";
  } catch (error) {
    logError(error, "Failed to restart services");
    return "failed";
  }
}

async function killBrokenServices() {
  const ret = await exec("/usr/local/centovacast/centovacast", ["status"], { timeout: 60000 });
  const statuses                = ret.stdout.toString().trim().split("\n");
  const failedServices                =
      statuses.filter((status) => !status.includes("running (pid"))
              .map((status) => status.split(":")[0]);

  for (const service of failedServices) {
    try {
      await exec("pkill", [service]);
      await exec("pkill", [service.replace("cc-", "")]);
    } catch (_) {}
  }
}

                         
              
               
                   
                  
  

async function getTopProcessesPerCpuUsage()                                   {
  const ret = await shell("top -b -n1 | head -n 12 | tail -n +8");
  const processes = ret.stdout.toString().trim().split("\n");
  return processes.map((line) => {
    const p = line.split(/ +/);
    //   PID USER      PR  NI  VIRT  RES  SHR S %CPU %MEM    TIME+  COMMAND
    return { user: p[1], pid: parseInt(p[0], 10), cpuUsage: parseFloat(p[8], 10),
             command: p.splice(11).join(" ") };
  });
}

// PID -> number of consecutive cycles a PID has been using >90% CPU
let topProcessUsageMap                                                      = new Map();

async function updateCentovaResourceHogsMap() {
  const topProcesses = await getTopProcessesPerCpuUsage();

  topProcessUsageMap.forEach((entry) => entry.stale = true);

  // Update the usage map
  // Increment the overuse cycle count for ccuser processes that have been using over 90% CPU
  topProcesses.filter((processInfo) =>
      processInfo.user == "ccuser" && processInfo.cpuUsage >= 90 &&
      !processInfo.command.includes("mp3gain")
  )
    .forEach((processInfo) => {
      const entry = topProcessUsageMap.get(processInfo.pid);

      topProcessUsageMap.set(processInfo.pid, {
        stale: false,
        overuseCycles: (entry ? entry.overuseCycles : 0) + 1,
      });
    });

  // Eliminate stale entries
  for (const iterator of topProcessUsageMap.entries()) {
    if (iterator[1].stale)
      topProcessUsageMap.delete(iterator[0]);
  }
}

async function killCentovaResourceHogs() {
  for (const iterator of topProcessUsageMap.entries()) {
    if (iterator[1].overuseCycles < 30)
      continue;

    // Now kill the process
    const pid         = iterator[0];
    try {
      const psRet = await exec("ps", ["-p", pid.toString(), "-o", "cmd="]);
      log(`⚠ Killing resource hog ${pid} (${psRet.stdout.toString().trim()})`);
      await exec("/bin/kill", ["-9", pid.toString()]);
      topProcessUsageMap.delete(pid);
    } catch (error) {
      logError(error, "Failed to kill resource hog " + pid);
    }
  }
}

async function isUpdateRunning()                {
  try {
    await exec("/usr/bin/pgrep", ["-f", "/usr/local/centovacast/sbin/update"]);
    return true;
  } catch (error) {
    return false;
  }
}

let lastRestartDate        = null;
let lastCheckOk       = false;
let restartCount         = 0;

async function mainLoop() {
  if (await isUpdateRunning()) {
    return;
  }

  const MS_BETWEEN_FAILED_RESTARTS = 15 * 1000;
  if (!lastRestartDate || (new Date() - lastRestartDate) > MS_BETWEEN_FAILED_RESTARTS) {
    const aggressive = restartCount >= 3;
    const result                = await ensureServicesRunning(aggressive);

    if (result === "ok" && !lastCheckOk) {
      log("✅ All services running fine");
    }

    if (restartCount >= 5) {
      log("🔴 Failed to bring up all Centova Cast services after 5 attempts");
    }

    lastRestartDate = result === "ok" ? null : new Date();
    restartCount = result === "ok" ? 0 : (restartCount + 1);
    lastCheckOk = result === "ok";
  }

  await killCentovaResourceHogs();
  setTimeout(mainLoop, 1000);
}

setInterval(updateCentovaResourceHogsMap, 1000);
log("ℹ Monitoring started");
mainLoop();
