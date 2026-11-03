# Use Case Diagram — SyncDrive

```mermaid
%%{init: {"theme": "dark"}}%%
graph LR
    Driver(["👤 Driver"])
    System(["🖥️ SyncDrive App"])

    Driver --> UC1["Select Origin & Destination"]
    Driver --> UC2["Set Arrival Time"]
    Driver --> UC3["Calculate Green Wave Route"]
    Driver --> UC4["View Recommended Speed"]
    Driver --> UC5["View Departure Time"]
    Driver --> UC6["Compare vs Normal GPS"]
    Driver --> UC7["View Signal Timeline"]
    Driver --> UC8["View Turn-by-Turn Steps"]
    Driver --> UC15["Choose Mode: Drive / Walk / Cycle / SOS"]
    Driver --> UC16["Start Live Drive Simulation"]
    Driver --> UC17["Toggle Map Layers: Signals / Timers / Places"]
    Driver --> UC18["Enable Voice Guidance"]
    Dispatcher(["Ambulance Dispatcher"]) --> UC19["Dispatch Ambulance (SOS mode)"]
    UC19 --> UC20["<<include>> Force Green Corridor"]
    UC19 --> UC21["<<include>> Make Other Vehicles Yield"]
    UC16 --> UC22["<<include>> Live Speed Advisor"]

    UC3 --> UC9["<<include>> Run Green Wave Optimizer"]
    UC3 --> UC10["<<include>> Run Normal GPS Simulation"]
    UC3 --> UC11["<<include>> Render Route on Map"]
    UC9 --> UC12["<<include>> Simulate Signal Phases"]
    UC10 --> UC12

    UC11 --> UC13["<<extend>> Colour Signals Green/Red"]
    UC11 --> UC14["<<extend>> Show Speed HUD Overlay"]
```

## Description

| Use Case | Actor | Description |
|---|---|---|
| Select Origin & Destination | Driver | Choose from 14 Chandigarh locations, or click a place on the map |
| Set Arrival Time | Driver | Target time to reach destination |
| Calculate Green Wave Route | Driver | Triggers full optimization pipeline |
| View Recommended Speed | Driver | Steady km/h to maintain on route |
| View Departure Time | Driver | Optimal leave-at time |
| Compare vs Normal GPS | Driver | Time saved, reds avoided, wait time |
| View Signal Timeline | Driver | Per-signal green/red status + arrival time |
| View Turn-by-Turn Steps | Driver | Street-level directions |
| Run Green Wave Optimizer | System | Searches 15 speeds × 25 min window, plus per-stretch speed refinement |
| Run Normal GPS Simulation | System | Naive departure (no signal knowledge), 50 km/h, accumulates waits |
| Simulate Signal Phases | System | phase = (dep + travel + elapsed) % cycle |
| Render Route on Map | System | Blue polyline + ghost red dashed overlay |
| Colour Signals Green/Red | System | Updates signal circle fill colours |
| Show Speed HUD Overlay | System | Bottom-right speed badge on map |
| Choose Mode | Driver | Drive, Walk, Cycle (speed profiles) or SOS (ambulance) |
| Start Live Drive Simulation | Driver | Race SyncDrive vs Normal GPS at 1x-16x with pause, follow-camera and manual speed |
| Toggle Map Layers | Driver | All layers / Signals / Timers / Places on or off |
| Enable Voice Guidance | Driver | Spoken advice in a female English voice, voice selectable |
| Dispatch Ambulance | Dispatcher | SOS mode: ambulance run with green corridor |
| Force Green Corridor | System | Signals within 500 m ahead of the ambulance forced green |
| Make Other Vehicles Yield | System | Vehicles within 350 m ahead slow to 6-12 km/h and hold at corridor signals |
| Live Speed Advisor | System | Suggests the speed that reaches the next signal on green |
