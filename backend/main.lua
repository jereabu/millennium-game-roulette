local logger     = require("logger")
local millennium = require("millennium")

-- Registers the ffi functions the frontend calls (GetInstalledGames, GetGameGenres).
require("library")

local function on_load()
    logger:info("Game Roulette loaded (Millennium " .. millennium.version() .. ")")
    millennium.ready()
end

local function on_unload()
    logger:info("Game Roulette unloaded")
end

local function on_frontend_loaded()
    logger:info("Game Roulette frontend loaded")
end

return {
    on_load = on_load,
    on_unload = on_unload,
    on_frontend_loaded = on_frontend_loaded,
}
