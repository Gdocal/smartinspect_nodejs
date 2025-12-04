/**
 * SchedulerAction - Action types for scheduler commands
 * Port of C# SchedulerAction.cs
 */

const SchedulerAction = {
    Connect: 0,
    WritePacket: 1,
    Disconnect: 2,
    Dispatch: 3
};

module.exports = { SchedulerAction };
