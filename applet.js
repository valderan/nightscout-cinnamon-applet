/**
 * Nightscout Cinnamon Applet
 *
 * Displays blood glucose data from Nightscout CGM monitoring system
 * on the Cinnamon desktop panel.
 *
 * @author ImmRanneft (original)
 * @author Valderan (fork, Nightscout API v14+/v15+ support)
 * @version 0.3.0
 * @license Same as Cinnamon Spices
 *
 * Debug: tail -f ~/.xsession-errors | grep nightscout
 */

const Applet = imports.ui.applet;
const ByteArray = imports.byteArray;
const Mainloop = imports.mainloop;
const Soup = imports.gi.Soup;
const Settings = imports.ui.settings;

/* ============================================================================
 * GLOBAL CONFIGURATION
 * ============================================================================ */

/**
 * Enable/disable debug logging to ~/.xsession-errors
 * @type {boolean}
 */
const logging = false;

/**
 * HTTP session for API requests.
 * Automatically configured for Soup 2.x or 3.x compatibility.
 * @type {Soup.Session}
 */
var _httpSession;
if (Soup.MAJOR_VERSION === 2) {
    _httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());
} else {
    _httpSession = new Soup.Session();
}

/* ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================ */

/**
 * Logs a message to the system log with applet prefix.
 * Messages can be viewed with: tail -f ~/.xsession-errors | grep nightscout
 *
 * @param {string} message - Message to log
 */
const log = function(message) {
    if (logging) global.log(`[nightscout@ranneft]: ${message}`);
}

/**
 * Makes an HTTP request to the specified URI.
 * Supports both Soup 2.x and 3.x APIs.
 *
 * @deprecated Use direct Promise-based requests with api-secret header instead
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} uri - Target URI
 * @param {Function} cb - Callback function(resolve, response)
 * @returns {Promise} Promise that resolves with the parsed JSON response
 */
const makeHttpRequest = function(method, uri, cb) {
    uri = uri.replace(/([^:])\/{2,}/, '$1/');
    return new Promise((resolve, reject) => {
        log(`Making a ${method} request to ${uri}`);
        const request = Soup.Message.new(method, uri);
        request.request_headers.append('accept', 'application/json');

        if (Soup.MAJOR_VERSION === 2) {
            _httpSession.queue_message(request, (_httpSession, message) => {
                if (message.status_code === 200) {
                    const responseParsed = JSON.parse(message.response_body.data);
                    cb(resolve, responseParsed);
                } else {
                    log(`Failed to acquire request (${message.status_code})`);
                    reject(`Failed to acquire request (${message.status_code})`);
                }
            });
        } else {
            _httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (session, response) => {
                if (request.get_status() === 200) {
                    try {
                        const bytes = _httpSession.send_and_read_finish(response);
                        const responseParsed = JSON.parse(ByteArray.toString(bytes.get_data()));
                        cb(resolve, responseParsed);
                        return;
                    } catch (error) {
                        log(error);
                    }
                    log(`Failed to acquire request (${message.status_code})`);
                    reject(`Failed to acquire request (${message.status_code})`);
                }
            });
        }
    });
}

/**
 * Rounds a number using a specified rounding function and precision.
 * Used for converting mg/dL to mmol/L with proper rounding.
 *
 * @param {Function} func - Rounding function (Math.ceil, Math.floor, Math.round)
 * @param {number} prec - Number of decimal places
 * @param {number} value - Value to round
 * @returns {number} Rounded value
 *
 * @example
 * // Round 5.67 up to 1 decimal place
 * roundUsing(Math.ceil, 1, 5.67) // returns 5.7
 */
const roundUsing = function(func, prec, value) {
    var temp = value * Math.pow(10, prec);
    temp = func(temp);
    return temp / Math.pow(10, prec);
}

/* ============================================================================
 * APPLET CONSTRUCTOR
 * ============================================================================ */

/**
 * Creates a new NightscoutApplet instance.
 *
 * @constructor
 * @param {Object} metadata - Applet metadata from metadata.json
 * @param {number} orientation - Panel orientation (top/bottom/left/right)
 * @param {number} panelHeight - Height of the panel in pixels
 * @param {string} instance_id - Unique instance identifier
 */
function NightscoutApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

/* ============================================================================
 * APPLET PROTOTYPE
 * ============================================================================ */

NightscoutApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    /* ------------------------------------------------------------------------
     * INSTANCE PROPERTIES
     * ------------------------------------------------------------------------ */

    /**
     * Last received blood glucose entry from Nightscout.
     * Used for detecting stale data and showing "missing readings" alerts.
     * @type {Object|null}
     */
    last: null,

    /**
     * Flag indicating whether an alert should be applied.
     * Reserved for future use (visual alerts for high/low BG).
     * @type {boolean}
     */
    applyAlert: false,

    /**
     * Current alerting state.
     * Reserved for future use.
     * @type {*}
     */
    alerting: null,

    /* ------------------------------------------------------------------------
     * SETTINGS PROPERTIES (bound from settings-schema.json)
     * ------------------------------------------------------------------------ */

    /**
     * Nightscout API token for authentication.
     * Sent as 'api-secret' header in API requests.
     * @type {string}
     * @setting token
     */
    token: "",

    /**
     * Nightscout server URL (e.g., "https://my-nightscout.herokuapp.com").
     * @type {string}
     * @setting host
     */
    host: "",

    /**
     * Data refresh interval in minutes (1-10).
     * @type {number}
     * @setting refreshInterval
     */
    refreshInterval: 2,

    /**
     * Use mmol/L units instead of mg/dL.
     * Conversion: mmol/L = mg/dL * 0.0555
     * @type {boolean}
     * @setting usemmol
     */
    usemmol: true,

    /**
     * Show warning when readings are missing/stale.
     * @type {boolean}
     * @setting showMissing
     */
    showMissing: true,

    /**
     * Time threshold (in minutes) after which to show missing readings alert.
     * @type {number}
     * @setting showMissingInterval
     */
    showMissingInterval: 15,

    /**
     * High glucose threshold value (in user's preferred units).
     * @type {number}
     * @setting highThreshold
     */
    highThreshold: 10,

    /**
     * Color to display when glucose is at or above high threshold.
     * @type {string}
     * @setting highColor
     */
    highColor: "red",

    /**
     * Low glucose threshold value (in user's preferred units).
     * @type {number}
     * @setting lowThreshold
     */
    lowThreshold: 4,

    /**
     * Color to display when glucose is at or below low threshold.
     * @type {string}
     * @setting lowColor
     */
    lowColor: "yellow",

    /* ------------------------------------------------------------------------
     * LIFECYCLE METHODS
     * ------------------------------------------------------------------------ */

    /**
     * Initializes the applet.
     * Sets up settings bindings, initial UI state, and starts the update loop.
     *
     * @param {Object} metadata - Applet metadata
     * @param {number} orientation - Panel orientation
     * @param {number} panelHeight - Panel height
     * @param {string} instance_id - Instance ID
     */
    _init: function(metadata, orientation, panelHeight, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);

        // Bind settings from settings-schema.json to instance properties
        this.settings.bindProperty(Settings.BindingDirection.IN, "usemmol", "usemmol", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "token", "token", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "refreshInterval", "refreshInterval", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "host", "host", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showMissing", "showMissing", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "showMissingInterval", "showMissingInterval", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "highThreshold", "highThreshold", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "highColor", "highColor", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "lowThreshold", "lowThreshold", this._updateSettings, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "lowColor", "lowColor", this._updateSettings, null);

        try {
            this.set_applet_icon_path(metadata.path + '/icons/nightscout.png');
            this.set_applet_label("Loading...");
            this.set_applet_tooltip("Nightscout");
            this.startUp(true);
        } catch (e) {
            global.logError(e);
        }
    },

    /**
     * Reads current values from settings and updates instance properties.
     * Called automatically when any bound setting changes.
     */
    _updateSettings: function() {
        this.token = this.settings.get_string("token");
        this.host = this.settings.get_string("host");
        this.refreshInterval = this.settings.get_int("refreshInterval");
        this.usemmol = this.settings.get_boolean("usemmol");
        this.showMissing = this.settings.get_boolean("showMissing");
        this.showMissingInterval = this.settings.get_int("showMissingInterval");
        this.highThreshold = this.settings.get_double("highThreshold");
        this.highColor = this.settings.get_string("highColor");
        this.lowThreshold = this.settings.get_double("lowThreshold");
        this.lowColor = this.settings.get_string("lowColor");
        log("Settings updated: host=" + this.host + ", token=" + (this.token ? "OK" : "EMPTY"));
    },

    /**
     * Called when settings change (legacy callback).
     * Triggers a UI update.
     *
     * @param {*} event - Settings change event
     */
    on_settings_changed: function(event) {
        this.startUp(false);
    },

    /**
     * Called when the applet is clicked.
     * Triggers an immediate data refresh.
     *
     * @param {*} event - Click event
     */
    on_applet_clicked: function(event) {
        this.updateUI();
    },

    /**
     * Starts the applet.
     *
     * @param {boolean} setupLoop - If true, starts the periodic update loop.
     *                              If false, just updates UI once.
     */
    startUp: function(setupLoop) {
        if (setupLoop) {
            this.updateLoop(true);
        } else {
            this.updateUI();
        }
    },

    /* ------------------------------------------------------------------------
     * UI METHODS
     * ------------------------------------------------------------------------ */

    /**
     * Applies color styling to the applet label based on glucose thresholds.
     *
     * @param {number} bgValue - Blood glucose value in current units (mmol/l or mg/dl)
     */
    applyColorStyle(bgValue) {
        let style = '';
        if (bgValue >= this.highThreshold) {
            style = `color: ${this.highColor};`;
        } else if (bgValue <= this.lowThreshold) {
            style = `color: ${this.lowColor};`;
        }
        this._applet_label.set_style(style);
    },

    /**
     * Builds and sets the blood glucose display string for the panel.
     *
     * Format: "BG: <value> <trend_arrow>"
     * With stale data: "!Last X m ago! BG: <value> <trend_arrow>"
     *
     * Trend arrows:
     * - Flat: →
     * - FortyFiveUp: ⬈ (rising slowly)
     * - FortyFiveDown: ⬊ (falling slowly)
     * - SingleUp/Down: ↑/↓
     * - DoubleUp/Down: ↑↑/↓↓
     * - TripleUp/Down: ↑↑↑/↓↓↓
     *
     * @param {Object} current - Current BG entry from Nightscout API
     * @param {number} current.sgv - Sensor glucose value in mg/dL
     * @param {string} current.direction - Trend direction string
     * @param {number} current.date - Timestamp in milliseconds
     */
    makeBGstring(current) {
        let bgString = "BG: ";

        // Convert mg/dL to mmol/L if needed (multiply by 0.0555)
        const bgValue = this.usemmol
            ? roundUsing(Math.ceil, 1, current.sgv * 0.0555).toFixed(1)
            : current.sgv;
        bgString += bgValue;

        // Add trend arrow based on direction
        switch (current.direction) {
            case 'Flat':
                bgString += ' →';
                break;
            case 'FortyFiveUp':
                bgString += ' ⬈';
                break;
            case 'FortyFiveDown':
                bgString += ' ⬊';
                break;
            case 'SingleDown':
                bgString += ' ↓';
                break;
            case 'DoubleDown':
                bgString += ' ↓↓';
                break;
            case 'TripleDown':
                bgString += ' ↓↓↓';
                break;
            case 'SingleUp':
                bgString += ' ↑';
                break;
            case 'DoubleUp':
                bgString += ' ↑↑';
                break;
            case 'TripleUp':
                bgString += ' ↑↑↑';
                break;
            default:
                break;
        }

        // Add stale data warning if enabled and data is old
        if (this.showMissing && this.last) {
            const lastDate = this.last.date;
            const currentDate = Date.now();
            const minutesAgo = Math.floor((currentDate - lastDate) / 60 / 1000);
            if (minutesAgo > this.showMissingInterval) {
                bgString = "!Last " + minutesAgo + " m ago!   " + bgString;
            }
        }

        this.set_applet_label(bgString);

        // Apply color based on thresholds (bgValue is already in user's preferred units)
        this.applyColorStyle(parseFloat(bgValue));
    },

    /**
     * Builds and sets the tooltip text with device status information.
     *
     * Shows:
     * - Last update time
     * - Device name (uploader phone)
     * - Battery percentage
     *
     * @param {Object} status - Device status from Nightscout API
     * @param {string} [status.device] - Device name
     * @param {Object} [status.uploader] - Uploader info
     * @param {number} [status.uploader.battery] - Battery percentage
     */
    makeTooltip(status) {
        let tooltip = "";

        // Last update time
        if (this.last) {
            const date = new Date();
            date.setTime(this.last.date);
            tooltip += "Last update: " + date.toUTCString() + "\n";
        }

        // Device name
        try {
            if (status.device) {
                tooltip += "Device: " + status.device + "\n";
            }
        } catch (e) {
            // Ignore if device info not available
        }

        // Uploader battery (Nightscout API v14+/v15+ structure)
        try {
            if (status.uploader && status.uploader.battery !== undefined) {
                tooltip += "Battery: " + status.uploader.battery + "%";
            } else {
                tooltip += "Battery: ?%";
            }
        } catch (e) {
            tooltip += "Battery: ?%";
        }

        this.set_applet_tooltip(tooltip);
    },

    /* ------------------------------------------------------------------------
     * API METHODS
     * ------------------------------------------------------------------------ */

    /**
     * Fetches the current blood glucose reading from Nightscout.
     *
     * Uses the /api/v1/entries/sgv endpoint with api-secret authentication.
     * Compatible with Nightscout v14.0+ and v15.0+.
     *
     * @returns {Promise<Object>} Promise resolving to the current BG entry
     * @returns {number} return.sgv - Sensor glucose value in mg/dL
     * @returns {string} return.direction - Trend direction
     * @returns {number} return.date - Timestamp in milliseconds
     * @returns {string} return._id - Unique entry ID
     */
    requestCurrentBg() {
        let url = `${this.host}/api/v1/entries/sgv?count=1`;
        log('requestCurrentBg URL: ' + url);

        return new Promise((resolve, reject) => {
            const request = Soup.Message.new('GET', url);
            request.request_headers.append('accept', 'application/json');

            // Add API token authentication header
            if (this.token) {
                request.request_headers.append('api-secret', this.token);
            }

            log('Making a GET request to ' + url + ' with api-secret');

            if (Soup.MAJOR_VERSION === 2) {
                // Soup 2.x API
                _httpSession.queue_message(request, (_session, message) => {
                    if (message.status_code === 200) {
                        try {
                            const responseParsed = JSON.parse(message.response_body.data);
                            log('Requested current state ' + JSON.stringify(responseParsed));
                            let current = {};
                            if (responseParsed.length > 0) {
                                current = responseParsed[0];
                            }
                            resolve(current);
                        } catch (e) {
                            log('Error parsing current BG response: ' + e);
                            reject(e);
                        }
                    } else {
                        log(`Failed to acquire current BG (${message.status_code})`);
                        reject(`Failed to acquire current BG (${message.status_code})`);
                    }
                });
            } else {
                // Soup 3.x API
                _httpSession.send_and_read_async(
                    request,
                    Soup.MessagePriority.NORMAL,
                    null,
                    (session, response) => {
                        if (request.get_status() === 200) {
                            try {
                                const bytes = _httpSession.send_and_read_finish(response);
                                const responseParsed = JSON.parse(ByteArray.toString(bytes.get_data()));
                                log('Requested current state ' + JSON.stringify(responseParsed));
                                let current = {};
                                if (responseParsed.length > 0) {
                                    current = responseParsed[0];
                                }
                                resolve(current);
                            } catch (e) {
                                log('Error parsing current BG response: ' + e);
                                reject(e);
                            }
                        } else {
                            log(`Failed to acquire current BG (${request.get_status()})`);
                            reject(`Failed to acquire current BG (${request.get_status()})`);
                        }
                    }
                );
            }
        });
    },

    /**
     * Fetches the device status from Nightscout.
     *
     * Uses the /api/v1/devicestatus endpoint with api-secret authentication.
     * Returns information about the uploader device (phone).
     *
     * Response structure (Nightscout v15+):
     * {
     *   "_id": "...",
     *   "device": "Phone Model",
     *   "uploader": { "battery": 85, "type": "PHONE" },
     *   "created_at": "2024-...",
     *   "mills": 1234567890
     * }
     *
     * @returns {Promise<Object>} Promise resolving to device status
     */
    requestDeviceStatus() {
        let url = `${this.host}/api/v1/devicestatus?count=1`;
        log('requestDeviceStatus URL: ' + url);

        return new Promise((resolve, reject) => {
            const request = Soup.Message.new('GET', url);
            request.request_headers.append('accept', 'application/json');

            // Add API token authentication header
            if (this.token) {
                request.request_headers.append('api-secret', this.token);
            }

            log('Making a GET request to ' + url + ' with api-secret');

            if (Soup.MAJOR_VERSION === 2) {
                // Soup 2.x API
                _httpSession.queue_message(request, (_session, message) => {
                    if (message.status_code === 200) {
                        try {
                            const responseParsed = JSON.parse(message.response_body.data);
                            log('Requested device status ' + JSON.stringify(responseParsed));
                            let status = {};
                            if (responseParsed.length > 0) {
                                status = responseParsed[0];
                            }
                            resolve(status);
                        } catch (e) {
                            log('Error parsing device status response: ' + e);
                            reject(e);
                        }
                    } else {
                        log(`Failed to acquire device status (${message.status_code})`);
                        reject(`Failed to acquire device status (${message.status_code})`);
                    }
                });
            } else {
                // Soup 3.x API
                _httpSession.send_and_read_async(
                    request,
                    Soup.MessagePriority.NORMAL,
                    null,
                    (session, response) => {
                        if (request.get_status() === 200) {
                            try {
                                const bytes = _httpSession.send_and_read_finish(response);
                                const responseParsed = JSON.parse(ByteArray.toString(bytes.get_data()));
                                log('Requested device status ' + JSON.stringify(responseParsed));
                                let status = {};
                                if (responseParsed.length > 0) {
                                    status = responseParsed[0];
                                }
                                resolve(status);
                            } catch (e) {
                                log('Error parsing device status response: ' + e);
                                reject(e);
                            }
                        } else {
                            log(`Failed to acquire device status (${request.get_status()})`);
                            reject(`Failed to acquire device status (${request.get_status()})`);
                        }
                    }
                );
            }
        });
    },

    /* ------------------------------------------------------------------------
     * UPDATE METHODS
     * ------------------------------------------------------------------------ */

    /**
     * Updates the applet UI by fetching fresh data from Nightscout.
     *
     * Fetches both current BG and device status in parallel,
     * then updates the panel label and tooltip.
     */
    updateUI: function() {
        try {
            Promise.all([this.requestCurrentBg(), this.requestDeviceStatus()])
                .then(values => {
                    log('updateUI success: ' + JSON.stringify(values[0]));

                    // Store first reading
                    if (!this.last) {
                        this.last = values[0];
                    }

                    // Update UI components
                    this.makeBGstring(values[0]);
                    this.makeTooltip(values[1]);

                    // Update last reading if changed
                    if (values[0] && values[0]._id && (this.last._id !== values[0]._id)) {
                        this.last = values[0];
                    }
                })
                .catch(e => {
                    log('updateUI Promise error: ' + e);
                    global.logError('[Nightscout] updateUI error: ' + e);
                });
        } catch (e) {
            log('updateUI sync error: ' + e);
            global.logError('[Nightscout] sync error: ' + e);
        }
    },

    /**
     * Main update loop that periodically refreshes data.
     *
     * Calls updateUI() immediately, then schedules itself
     * to run again after refreshInterval minutes.
     */
    updateLoop: function() {
        this.updateUI();
        Mainloop.timeout_add_seconds(this.refreshInterval * 60, this.updateLoop.bind(this));
    },
};

/* ============================================================================
 * ENTRY POINT
 * ============================================================================ */

/**
 * Main entry point called by Cinnamon when loading the applet.
 *
 * @param {Object} metadata - Applet metadata from metadata.json
 * @param {number} orientation - Panel orientation
 * @param {number} panelHeight - Panel height in pixels
 * @param {string} instance_id - Unique instance ID
 * @returns {NightscoutApplet} The applet instance
 */
function main(metadata, orientation, panelHeight, instance_id) {
    let nightscoutApplet = new NightscoutApplet(metadata, orientation, panelHeight, instance_id);
    return nightscoutApplet;
}
