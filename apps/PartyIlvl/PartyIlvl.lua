local addonName, ns = ...

-- Cache: GUID -> { ilvl = number, time = number }
ns.cache = {}

-- Inspect queue: list of unitIDs waiting to be inspected
ns.inspectQueue = {}
ns.inspectBusy = false
ns.inspectNonce = 0
ns.inspectQueued = {} -- set of GUIDs already in queue (dedup)

-- Main event frame
local frame = CreateFrame("Frame")
frame:RegisterEvent("GROUP_ROSTER_UPDATE")
frame:RegisterEvent("INSPECT_READY")
frame:RegisterEvent("UNIT_INVENTORY_CHANGED")

frame:SetScript("OnEvent", function(self, event, ...)
    if ns[event] then
        ns[event](...)
    end
end)

---------------------------------------------------------------------------
-- Group scanning and inspect queue
---------------------------------------------------------------------------

-- Returns a list of unitIDs for current party/raid members (excluding player)
local function GetGroupUnitIDs()
    local units = {}
    if IsInRaid() then
        for i = 1, GetNumGroupMembers() do
            local unit = "raid" .. i
            if not UnitIsUnit(unit, "player") then
                table.insert(units, unit)
            end
        end
    elseif IsInGroup() then
        for i = 1, GetNumGroupMembers() - 1 do
            table.insert(units, "party" .. i)
        end
    end
    return units
end

local INSPECT_THROTTLE = 1.5

local function ProcessInspectQueue()
    if ns.inspectBusy or #ns.inspectQueue == 0 then
        return
    end

    local unit = table.remove(ns.inspectQueue, 1)
    local guid = UnitGUID(unit)
    if guid then
        ns.inspectQueued[guid] = nil
    end

    -- Skip invalid/out-of-range units
    if not UnitExists(unit) or not UnitIsVisible(unit) or not CanInspect(unit) then
        -- Try next in queue
        C_Timer.After(0.1, ProcessInspectQueue)
        return
    end

    ns.inspectBusy = true
    ns.inspectNonce = ns.inspectNonce + 1
    local myNonce = ns.inspectNonce
    NotifyInspect(unit)

    -- Safety timeout: if INSPECT_READY never fires, unblock after 3s
    C_Timer.After(3, function()
        if ns.inspectNonce == myNonce then
            ns.inspectBusy = false
            ProcessInspectQueue()
        end
    end)
end

local function QueueInspect(unit)
    local guid = UnitGUID(unit)
    if guid and not ns.cache[guid] and not ns.inspectQueued[guid] then
        ns.inspectQueued[guid] = true
        table.insert(ns.inspectQueue, unit)
    end
end

local function QueueInspectAll()
    ns.inspectQueue = {}
    ns.inspectQueued = {}
    local units = GetGroupUnitIDs()
    for _, unit in ipairs(units) do
        QueueInspect(unit)
    end
    ProcessInspectQueue()
end

---------------------------------------------------------------------------
-- Event handlers
---------------------------------------------------------------------------

function ns.GROUP_ROSTER_UPDATE()
    -- Clear cache for members who left
    local currentGUIDs = {}
    for _, unit in ipairs(GetGroupUnitIDs()) do
        local guid = UnitGUID(unit)
        if guid then
            currentGUIDs[guid] = true
        end
    end
    for guid in pairs(ns.cache) do
        if not currentGUIDs[guid] then
            ns.cache[guid] = nil
        end
    end

    -- Queue inspect for new members
    QueueInspectAll()
end

function ns.INSPECT_READY(inspecteeGUID)
    ns.inspectNonce = ns.inspectNonce + 1 -- invalidate pending safety timeout
    ns.inspectBusy = false

    -- Find the unit for this GUID
    local unit
    for _, u in ipairs(GetGroupUnitIDs()) do
        if UnitGUID(u) == inspecteeGUID then
            unit = u
            break
        end
    end

    if unit then
        local ilvl = C_PaperDoll.GetInspectItemLevel(unit)
        if ilvl and ilvl > 0 then
            ns.cache[inspecteeGUID] = {
                ilvl = math.floor(ilvl + 0.5),
                time = GetTime(),
            }
        end
    end

    ClearInspectPlayer()

    -- Process next in queue
    C_Timer.After(INSPECT_THROTTLE, ProcessInspectQueue)
end

function ns.UNIT_INVENTORY_CHANGED(unit)
    if UnitInParty(unit) or UnitInRaid(unit) then
        local guid = UnitGUID(unit)
        if guid then
            ns.cache[guid] = nil
            QueueInspect(unit)
            ProcessInspectQueue()
        end
    end
end

---------------------------------------------------------------------------
-- Tooltip hook
---------------------------------------------------------------------------

TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Unit, function(tooltip, data)
    if tooltip ~= GameTooltip then return end

    local _, unit = tooltip:GetUnit()
    if not unit then return end

    -- Only show for party/raid members
    if not (UnitInParty(unit) or UnitInRaid(unit)) then return end
    -- Don't show for self
    if UnitIsUnit(unit, "player") then return end

    local guid = UnitGUID(unit)
    if not guid then return end

    local cached = ns.cache[guid]
    if cached then
        tooltip:AddLine(string.format("Item Level: %d", cached.ilvl), 1, 0.82, 0, false)
    else
        -- Queue inspect for next time
        if CanInspect(unit) then
            QueueInspect(unit)
            ProcessInspectQueue()
        end
    end
end)
