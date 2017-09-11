// Centowatch
// Licensed under GPLv2 - Copyright 2017 The Innovating Group
//      

const child_process = require("child_process");

// Check if Centova services are running: if not, restart them
function ensureCentovaServicesRunning()       {
  const ret = child_process.spawnSync("/usr/local/centovacast/centovacast", ["status"], {
    timeout: 2000,
  });

  if (ret.error) {
    console.error("ensureCentovaServicesRunning: Failed to check status");
    console.error(ret.error);
    return false;
  }

  const statuses                = ret.stdout.toString().trim().split("\n");
  const allStarted       = statuses.every((status) => status.includes("running (pid"));

  if (allStarted) {
    return true;
  }

  console.error("ensureCentovaServicesRunning: Restarting services");
  const restartRet = child_process.spawnSync("/usr/local/centovacast/centovacast", ["start"], {
    timeout: 2000,
  });

  if (restartRet.error) {
    console.error("ensureCentovaServicesRunning: Failed to restart services");
    console.error(restartRet.error);
    return false;
  }

  return true;
}

                         
              
               
                   
  

function getTopProcessesPerCpuUsage()                           {
  try {
    const output = child_process.execSync("top -b -n1 | head -n 12 | tail -n +8");
    const processes = output.toString().trim().split("\n");
    return processes.map((line) => {
      const p = line.split(/ +/);
      //   PID USER      PR  NI  VIRT  RES  SHR S %CPU %MEM    TIME+  COMMAND
      return { user: p[1], pid: parseInt(p[0], 10), cpuUsage: parseFloat(p[8], 10), };
    });
  } catch (error) {
    console.error(error);
    return null;
  }
}

// PID -> number of consecutive cycles a PID has been using >90% CPU
let topProcessUsageMap                                                      = new Map();

function updateCentovaResourceHogsMap()       {
  const topProcesses = getTopProcessesPerCpuUsage();
  if (!topProcesses) {
    console.error("killCentovaResourceHogs: Failed to get top processes per CPU usage");
    return false;
  }

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

  return true;
}

function killCentovaResourceHogs() {
  for (const iterator of topProcessUsageMap.entries()) {
    if (iterator[1].overuseCycles < 30)
      continue;

    // Now kill the process
    const pid         = iterator[0];
    const ret = child_process.spawnSync("/bin/kill", ["-9", pid.toString()]);

    if (ret.error) {
      console.error("killCentovaResourceHogs: Failed to kill PID " + pid);
      continue;
    }

    // Remove the entry, since the process has been killed
    topProcessUsageMap.delete(pid);
  }
}

function mainLoop() {
  ensureCentovaServicesRunning();

  // Check if Centova processes (streaming software) are using too much CPU (>85%)
  // for 30 cycles: if so, kill them
  updateCentovaResourceHogsMap();
  killCentovaResourceHogs();
}

console.log("Monitoring started");
mainLoop();
setInterval(mainLoop, 500);
