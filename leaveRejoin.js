function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

function parseIntervalToMs(value, fallbackSeconds) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        // Backward compatible: numeric values are interpreted as seconds.
        return Math.max(1000, Math.floor(value * 1000))
    }

    if (typeof value === 'string') {
        const raw = value.trim().toLowerCase()
        const match = raw.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/)

        if (match) {
            const amount = Number(match[1])
            const unit = match[2] || 's'
            const multipliers = {
                ms: 1,
                s: 1000,
                m: 60 * 1000,
                h: 60 * 60 * 1000
            }
            return Math.max(1000, Math.floor(amount * multipliers[unit]))
        }
    }

    return Math.max(1000, Math.floor(fallbackSeconds * 1000))
}

function setupLeaveRejoin(bot, createBot, markIntentionalLeave, setNextLeaveAt) {
    // Timers
    let leaveTimer = null
    let jumpTimer = null
    let jumpOffTimer = null
    let reconnectTimer = null

    // State
    let stopped = false
    let reconnectAttempts = 0
    let lastLogAt = 0

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now()
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now
            console.log(msg)
        }
    }

    function cleanup() {
        stopped = true
        if (typeof setNextLeaveAt === 'function') {
            setNextLeaveAt(null)
        }
        if (leaveTimer) clearTimeout(leaveTimer)
        if (jumpTimer) clearTimeout(jumpTimer)
        if (jumpOffTimer) clearTimeout(jumpOffTimer)
        if (reconnectTimer) clearTimeout(reconnectTimer)
        leaveTimer = jumpTimer = jumpOffTimer = reconnectTimer = null
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return

        bot.setControlState('jump', true)
        jumpOffTimer = setTimeout(() => {
            bot.setControlState('jump', false)
        }, 300)

        // random jump 20s -> 5m
        const nextJump = randomMs(20000, 5 * 60 * 1000)
        jumpTimer = setTimeout(scheduleNextJump, nextJump)
    }

    function scheduleReconnect(reason = 'end') {
        if (stopped) return

        // Intentional rejoin should be quick, but not immediate spam.
        let delay = randomMs(4000, 9000)

        // Slight backoff for repeated failures, but keep it snappy
        reconnectAttempts++
        if (reconnectAttempts > 3) {
            delay += 3000
        }

        // Cap at 12s max for intentional rejoin flow
        delay = Math.min(delay, 15000)

        logThrottled(`[AFK] Rejoin scheduled in ${Math.round(delay / 1000)}s (reason: ${reason}, attempt: ${reconnectAttempts})`)

        reconnectTimer = setTimeout(() => {
            if (stopped) return
            try {
                if (typeof createBot === 'function') createBot()
            } catch (e) {
                console.log('[AFK] createBot error:', e?.message || e)
                scheduleReconnect('createBot-error')
            }
        }, delay)
    }

    function armLeaveCycle() {
        // Read config fresh every time (avoids stale cached values)
        const config = require('./settings.json');

        // reset attempt counter on successful connect
        reconnectAttempts = 0

        // clear any old timers
        cleanup()
        stopped = false

        // Read from settings.json periodic-rejoin (number = seconds, string supports ms/s/m/h)
        const periodicRejoin = config?.utils?.['periodic-rejoin'] || {}
        const minMs = parseIntervalToMs(periodicRejoin['min-interval'], 3600)
        const maxMs = parseIntervalToMs(periodicRejoin['max-interval'], 7200)
        const safeMinMs = Math.min(minMs, maxMs)
        const safeMaxMs = Math.max(minMs, maxMs)

        const stayTime = randomMs(safeMinMs, safeMaxMs)
        const leaveAt = Date.now() + stayTime
        if (typeof setNextLeaveAt === 'function') {
            setNextLeaveAt(leaveAt, { min: safeMinMs, max: safeMaxMs, stayTime })
        }

        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)} seconds`)

        scheduleNextJump()

        leaveTimer = setTimeout(() => {
            if (stopped) return
            logThrottled('[AFK] Leaving server (timer)')
            if (typeof markIntentionalLeave === 'function') {
                markIntentionalLeave()
            }
            cleanup()
            try {
                bot.quit()
            } catch (e) {
                // ignore if already closed
            }
        }, stayTime)
    }

    armLeaveCycle()

    // When the connection ends for ANY reason, just clean up our timers.
    // Reconnection is handled by index.js — no duplicate reconnect here.
    bot.on('end', () => {
        cleanup()
    })

    bot.on('kicked', () => {
        cleanup()
    })

    bot.on('error', () => {
        cleanup()
    })
}

module.exports = setupLeaveRejoin
