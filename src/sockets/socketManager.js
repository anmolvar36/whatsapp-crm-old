/**
 * Socket Manager
 * Centralized real-time event emitter.
 * Controllers import this to broadcast events after DB mutations.
 */

let ioInstance = null;

/**
 * Initialize the socket manager with the io server instance.
 * Call this once from server.js after io is created.
 */
const init = (io) => {
    ioInstance = io;
};

/**
 * Emit a realtime event to all connected clients.
 * @param {string} event - event name e.g. 'lead:new'
 * @param {*} data - payload to send
 */
const emit = (event, data) => {
    if (ioInstance) {
        ioInstance.emit(event, data);
    }
};

/**
 * Emit a realtime event to a specific room.
 * @param {string} room - room name e.g. role name 'ADMIN'
 * @param {string} event - event name
 * @param {*} data - payload to send
 */
const emitToRoom = (room, event, data) => {
    if (ioInstance) {
        ioInstance.to(room).emit(event, data);
    }
};

/**
 * Convenience helpers for common CRM events
 */
const events = {
    leadNew: (lead) => emit('lead:new', { type: 'lead:new', timestamp: new Date(), data: lead }),
    leadUpdate: (lead) => emit('lead:update', { type: 'lead:update', timestamp: new Date(), data: lead }),
    leadDelete: (id) => emit('lead:delete', { type: 'lead:delete', timestamp: new Date(), data: { id } }),
    messageNew: (message) => {
        emit('message:new', { type: 'message:new', timestamp: new Date(), data: message });
        emit('new_message', message);
    },
    dashboardRefresh: (stats) => emit('dashboard:refresh', { type: 'dashboard:refresh', timestamp: new Date(), data: stats }),
    notification: (notification) => emit('notification:new', { type: 'notification:new', timestamp: new Date(), data: notification }),
    channelUpdate: (channel) => emit('channel:update', { type: 'channel:update', timestamp: new Date(), data: channel }),
    userUpdate: (user) => emit('user:update', { type: 'user:update', timestamp: new Date(), data: user }),
};

module.exports = { init, emit, emitToRoom, events };
