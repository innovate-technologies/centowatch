// Centowatch
// Licensed under GPLv2 - Copyright 2017 The Innovating Group
//      

const { exec, log, logError, shell } = require("./util");

// Check if Centova services are running: if not, restart them
async function ensureServicesRunning()                {
  try {
    const ret = await exec("/usr/local/centovacast/centovacast", ["status"], { timeout: 60000 });
    const statuses                = ret.stdout.toString().trim().split("\n");
    const allStarted       = statuses.every((status) => status.includes("running (pid"));
    if (allStarted) {
      return true;
    }
  } catch (error) {
    logError(error, "ensureServicesRunning: Failed to check status");
    return false;
  }

  log("ensureServicesRunning: Restarting services");
  try {
    await exec("/usr/local/centovacast/centovacast", ["start"], { timeout: 60000 });
  } catch (error) {
    logError(error, "ensureServicesRunning: Failed to restart services");

    if (error.stderr.toString().includes("An another FPM instance seems to already listen")) {
      log("ensureServicesRunning: Trying to clean up FPM instance");
      try {
        await exec("rm", ["/usr/local/centovacast/var/run/cc-appserver.sock"]);
      } catch (error_) {
        logError(error_, "ensureServicesRunning: Failed to clean up FPM instance");
      }
    }
    return false;
  }

  return true;
}

                         
              
               
                   
  

async function getTopProcessesPerCpuUsage()                                   {
  const ret = await shell("top -b -n1 | head -n 12 | tail -n +8");
  const processes = ret.stdout.toString().trim().split("\n");
  return processes.map((line) => {
    const p = line.split(/ +/);
    //   PID USER      PR  NI  VIRT  RES  SHR S %CPU %MEM    TIME+  COMMAND
    return { user: p[1], pid: parseInt(p[0], 10), cpuUsage: parseFloat(p[8], 10), };
  });
}

// PID -> number of consecutive cycles a PID has been using >90% CPU
let topProcessUsageMap                                                      = new Map();

async function updateCentovaResourceHogsMap() {
  const topProcesses = await getTopProcessesPerCpuUsage();

  topProcessUsageMap.forEach((entry) => entry.stale = true);

  // Update the usage map
  // Increment the overuse cycle count for ccuser processes that have been using over 90% CPU
  topProcesses.filter((processInfo) => processInfo.user == "ccuser" && processInfo.cpuUsage >= 90)
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
    log("killCentovaResourceHogs: SIGKILL " + pid);
    try {
      await exec("/bin/kill", ["-9", pid.toString()]);
      topProcessUsageMap.delete(pid);
    } catch (error) {
      logError(error, "killCentovaResourceHogs: Failed to kill PID " + pid);
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

async function mainLoop() {
  if (await isUpdateRunning()) {
    return;
  }

  await ensureServicesRunning();

  // Check if Centova processes (streaming software) are using too much CPU (>85%)
  // for 30 cycles: if so, kill them
  await updateCentovaResourceHogsMap();
  await killCentovaResourceHogs();
}

log("Monitoring started");
mainLoop();
setInterval(mainLoop, 500);
