local logger     = require("logger")
local millennium = require("millennium")
local fs         = require("fs")
local utils      = require("utils")
local http       = require("http")

local ok_json, json = pcall(require, "json")
if not ok_json then json = require("cjson") end

-- Things Steam installs that are not games.
local EXCLUDED_APPIDS = {
    [228980]  = true, -- Steamworks Common Redistributables
    [250820]  = true, -- SteamVR
    [1070560] = true, -- Steam Linux Runtime 1.0 (scout)
    [1391110] = true, -- Steam Linux Runtime 2.0 (soldier)
    [1628350] = true, -- Steam Linux Runtime 3.0 (sniper)
    [1493710] = true, -- Proton Experimental
    [2180100] = true, -- Proton Hotfix
    [1826330] = true, -- Proton EasyAntiCheat Runtime
    [1161040] = true, -- Proton BattlEye Runtime
}

local EXCLUDED_NAME_PATTERNS = {
    "^Proton ", "Steam Linux Runtime", "Redistributable", "Steamworks",
    "SteamVR", "Dedicated Server", " SDK$", "Soundtrack$",
}

local function join(a, b)
    local last = a:sub(-1)
    if last == "/" or last == "\\" then return a .. b end
    return a .. "/" .. b
end

local function unescape_vdf(s)
    return (s:gsub("\\\\", "\\"):gsub('\\"', '"'))
end

local function is_excluded(appid, name)
    if EXCLUDED_APPIDS[appid] then return true end
    for _, pattern in ipairs(EXCLUDED_NAME_PATTERNS) do
        if name:find(pattern) then return true end
    end
    return false
end

-- Every Steam library folder (the main install plus any extra drives).
local function library_folders()
    local steam = millennium.steam_path()
    local folders, seen = {}, {}

    local function add(path)
        local key = path:lower():gsub("\\", "/"):gsub("/$", "")
        if not seen[key] then
            seen[key] = true
            table.insert(folders, path)
        end
    end

    add(steam)

    local vdf = utils.read_file(join(join(steam, "steamapps"), "libraryfolders.vdf"))
    if vdf then
        for path in vdf:gmatch('"path"%s+"(.-)"%s*[\r\n]') do
            add(unescape_vdf(path))
        end
    else
        logger:warn("Could not read libraryfolders.vdf, only scanning " .. steam)
    end
    return folders
end

local function vdf_field(text, key)
    local value = text:match('"' .. key .. '"%s+"(.-)"%s*[\r\n]')
    if value then return unescape_vdf(value) end
    return nil
end

local function parse_manifest(text)
    local appid = tonumber(vdf_field(text, "appid") or "")
    local name = vdf_field(text, "name")
    if not appid or not name then return nil end

    -- StateFlags bit 4 = fully installed. Updates in progress keep that bit set.
    local flags = tonumber(vdf_field(text, "StateFlags") or "0") or 0
    if math.floor(flags / 4) % 2 ~= 1 then return nil end

    return {
        appid = appid,
        name = name,
        size_on_disk = tonumber(vdf_field(text, "SizeOnDisk") or "0") or 0,
        last_played = tonumber(vdf_field(text, "LastPlayed") or "0") or 0,
    }
end

---@ffi
--- Scan every Steam library folder and return the installed games as a JSON array string.
---@return string
function GetInstalledGames()
    local games, seen = {}, {}

    for _, folder in ipairs(library_folders()) do
        local steamapps = join(folder, "steamapps")
        local ok_list, entries = false, nil
        if fs.exists(steamapps) then
            ok_list, entries = pcall(fs.list, steamapps)
        end
        if not fs.exists(steamapps) then
            logger:info("Skipping library folder that isn't available right now: " .. steamapps)
        elseif ok_list and type(entries) == "table" then
            for _, entry in ipairs(entries) do
                if entry.is_file and entry.name:match("^appmanifest_%d+%.acf$") then
                    local text = utils.read_file(entry.path or join(steamapps, entry.name))
                    local game = text and parse_manifest(text)
                    if game and not seen[game.appid] and not is_excluded(game.appid, game.name) then
                        seen[game.appid] = true
                        table.insert(games, game)
                    end
                end
            end
        else
            logger:warn("Could not list " .. steamapps .. ": " .. tostring(entries))
        end
    end

    logger:info(string.format("Found %d installed games", #games))
    if #games == 0 then return "[]" end
    return json.encode(games)
end

---@ffi
--- Look up a game's genres and categories on the Steam store.
--- Returns a JSON string {"genres": [...], "categories": [...]}, or "" if the lookup failed.
---@param appid number
---@return string
function GetGameGenres(appid)
    local id = tostring(math.floor(tonumber(appid) or 0))
    local url = "https://store.steampowered.com/api/appdetails?appids=" .. id .. "&filters=genres,categories&l=english"
    local res, err = http.get(url, { timeout = 8 })
    if not res or res.status ~= 200 then
        logger:warn("Genre lookup failed for " .. id .. ": " .. tostring(err or (res and res.status)))
        return ""
    end

    local ok, body = pcall(json.decode, res.body)
    local entry = ok and type(body) == "table" and body[id]
    if not entry or entry.success ~= true or type(entry.data) ~= "table" then
        return ""
    end

    local result = { genres = {}, categories = {} }
    for _, g in ipairs(entry.data.genres or {}) do
        table.insert(result.genres, g.description)
    end
    for _, c in ipairs(entry.data.categories or {}) do
        table.insert(result.categories, c.description)
    end
    -- Empty Lua tables would encode as {} rather than []; drop them, the frontend defaults to [].
    if #result.genres == 0 then result.genres = nil end
    if #result.categories == 0 then result.categories = nil end
    return json.encode(result)
end

-- The most recently used Steam account's localconfig.vdf (holds per-game playtime).
local function newest_localconfig()
    local userdata = join(millennium.steam_path(), "userdata")
    if not fs.exists(userdata) then return nil end
    local ok, entries = pcall(fs.list, userdata)
    if not ok or type(entries) ~= "table" then return nil end

    local best, best_time = nil, -1
    for _, entry in ipairs(entries) do
        if entry.is_directory then
            local path = join(join(entry.path or join(userdata, entry.name), "config"), "localconfig.vdf")
            if fs.exists(path) then
                local t = tonumber(fs.last_write_time(path)) or 0
                if t > best_time then best, best_time = path, t end
            end
        end
    end
    return best
end

---@ffi
--- Read per-game playtime that Steam saves for the current account.
--- Returns a JSON object string: { "<appid>": { "p": minutes total, "p2": minutes last 2 weeks, "lp": last played unix time } }.
---@return string
function GetPlaytimes()
    local path = newest_localconfig()
    local text = path and utils.read_file(path)
    if not text then
        logger:warn("Could not read localconfig.vdf for playtime")
        return "{}"
    end

    -- Several blocks are called "apps"; the one with the most Playtime entries is the play history.
    local apps_block, best_count = nil, 0
    for block in text:gmatch('"apps"%s*(%b{})') do
        local _, count = block:gsub('"Playtime"', "")
        if count > best_count then apps_block, best_count = block, count end
    end
    if not apps_block then return "{}" end

    local result, n = {}, 0
    -- %b{} consumes each app's whole block, so nested numeric keys aren't picked up as apps.
    for appid, body in apps_block:sub(2, -2):gmatch('"(%d+)"%s*(%b{})') do
        local p = tonumber(body:match('"Playtime"%s+"(%d+)"') or "")
        local p2 = tonumber(body:match('"Playtime2wks"%s+"(%d+)"') or "")
        local lp = tonumber(body:match('"LastPlayed"%s+"(%d+)"') or "")
        if p or lp then
            result[appid] = { p = p or 0, p2 = p2 or 0, lp = lp or 0 }
            n = n + 1
        end
    end

    logger:info(string.format("Read playtime for %d games", n))
    if n == 0 then return "{}" end
    return json.encode(result)
end

logger:info("Game Roulette library functions registered")
