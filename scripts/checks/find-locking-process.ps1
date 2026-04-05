param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$resolvedPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path

$code = @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Collections.Generic;

public static class LockFinder {
    const int RmRebootReasonNone = 0;
    const int CCH_RM_MAX_APP_NAME = 255;
    const int CCH_RM_MAX_SVC_NAME = 63;
    const int ERROR_MORE_DATA = 234;

    [StructLayout(LayoutKind.Sequential)]
    public struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_APP_NAME + 1)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_SVC_NAME + 1)]
        public string strServiceShortName;
        public uint ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);

    [DllImport("rstrtmgr.dll")]
    static extern int RmEndSession(uint pSessionHandle);

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmRegisterResources(
        uint pSessionHandle,
        uint nFiles,
        string[] rgsFilenames,
        uint nApplications,
        RM_UNIQUE_PROCESS[] rgApplications,
        uint nServices,
        string[] rgsServiceNames
    );

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmGetList(
        uint dwSessionHandle,
        out uint pnProcInfoNeeded,
        ref uint pnProcInfo,
        [In, Out] RM_PROCESS_INFO[] rgAffectedApps,
        ref uint lpdwRebootReasons
    );

    public static string[] GetLockingProcesses(string path) {
        uint handle;
        string key = Guid.NewGuid().ToString();
        int res = RmStartSession(out handle, 0, key);
        if (res != 0) {
            throw new Exception("RmStartSession failed: " + res);
        }

        try {
            string[] resources = new string[] { path };
            res = RmRegisterResources(handle, (uint)resources.Length, resources, 0, null, 0, null);
            if (res != 0) {
                throw new Exception("RmRegisterResources failed: " + res);
            }

            uint needed = 0;
            uint count = 0;
            uint reason = RmRebootReasonNone;
            res = RmGetList(handle, out needed, ref count, null, ref reason);

            if (res == ERROR_MORE_DATA) {
                RM_PROCESS_INFO[] processInfo = new RM_PROCESS_INFO[needed];
                count = needed;
                res = RmGetList(handle, out needed, ref count, processInfo, ref reason);
                if (res != 0) {
                    throw new Exception("RmGetList failed: " + res);
                }

                var result = new List<string>();
                for (int i = 0; i < count; i++) {
                    try {
                        var proc = Process.GetProcessById(processInfo[i].Process.dwProcessId);
                        result.Add(proc.ProcessName + "|" + proc.Id + "|" + processInfo[i].strAppName + "|" + proc.MainWindowTitle);
                    } catch {
                        result.Add("<exited>|" + processInfo[i].Process.dwProcessId + "|" + processInfo[i].strAppName + "|");
                    }
                }

                return result.ToArray();
            }

            if (res == 0) {
                return new string[0];
            }

            throw new Exception("RmGetList failed: " + res);
        }
        finally {
            RmEndSession(handle);
        }
    }
}
"@

Add-Type -TypeDefinition $code -ErrorAction Stop

try {
    $locks = [LockFinder]::GetLockingProcesses($resolvedPath)
}
catch {
    Write-Output "LOCK_CHECK_ERROR|$resolvedPath|$($_.Exception.Message)"
    exit 1
}

if ($locks.Count -eq 0) {
    Write-Output "NO_LOCKS_REPORTED|$resolvedPath"
    exit 0
}

$locks | ForEach-Object {
    $parts = $_ -split '\|', 4
    [PSCustomObject]@{
        ProcessName = $parts[0]
        Id = $parts[1]
        AppName = $parts[2]
        WindowTitle = $parts[3]
        Path = $resolvedPath
    }
}
