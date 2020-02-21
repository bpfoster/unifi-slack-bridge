const UnifiEvents = require('unifi-events')
const rp = require('request-promise')

// Helper function.  Get environment variable or die trying.
const requireEnv = (key) => {
  if (!process.env[key]) {
    console.log("Missing configuration " + key)
    process.exit(1)
  }
  return process.env[key]
}

// Helper function.  Return true if the value is a MAC address
const _isMacAddress = (addr) => {
  return addr.match(/([a-fA-F0-9]{2}:){5}[a-fA-F0-9]{2}/)
}

// Slack configuration
const webhookUrl = requireEnv('SLACK_WEBHOOK')
const slackUsername = process.env.SLACK_USERNAME || 'UniFi Notify'

// Unifi websocket connnection
let unifi = new UnifiEvents({
  controller: requireEnv('UNIFI_CONTROLLER'),
  username: requireEnv('UNIFI_USERNAME'),
  password: requireEnv('UNIFI_PASSWORD'),
  site: process.env.UNIFI_SITE || 'default',
  rejectUnauthorized: false  // allow self-signed certs
})


let registeredEvents = []

// Send text to slack, and log it to stdout when done
const _sendNotification = (text) => {
  return rp.post(webhookUrl, {
    json: {
      text: text,
      username: slackUsername
    }
  })
    .then(() => {
      console.log(text)
    })
    .catch((err) => {
      console.log(err)
    })
}

const _callback = (data) => {
  // When Guest or AP shows MAC address, try and resolve that to displayable names
  Promise.resolve(data.msg)
    .then(msg => {
      let guestMatch = msg.match(/Guest\[(.*?)\]/)
      if (guestMatch && _isMacAddress(guestMatch[1])) {
        return unifi.getClient(guestMatch[1])
          .then(client =>
            msg.replace(guestMatch[1], client.name || client.hostname || guestMatch[1])
          ).catch(() =>
            msg
          )
      } else {
        return msg
      }
    })
    .then(msg => {
      let apMatch = msg.match(/AP\[(.*?)\]/)
      if (apMatch && _isMacAddress(apMatch[1])) {
        return unifi.getAp(apMatch[1])
          .then(ap =>
            msg.replace(apMatch[1], ap.name || apMatch[1])
          ).catch(() =>
            msg
          )
      } else {
        return msg
      }
    })
    .then(msg => {
      _sendNotification(msg)
    })

}

// Given the unifi notification configuration, make sure we're subscribed to all events with push notifications enabled
const _registerListeners = (eventConfig) => {
  registeredEvents.forEach(event => {
    unifi.removeListener(event, _callback)
  })

  registeredEvents = Object.keys(eventConfig).filter(key => key.startsWith('EVT_') && eventConfig[key].push_enabled)

  registeredEvents.forEach(event => {
    unifi.on(event, _callback)
  })
}

// Get notification settings and subscribe to enabled events
unifi.getNotificationConfiguration().then(data => {
  let eventConfig = data.data.find(elem => elem.key == 'super_events')

  _registerListeners(eventConfig)
})

// super_events event fired when notification settings are changed
unifi.on('super_events', data => {
  console.log("Notification preferences updated.  Re-subscribing...")
  _registerListeners(data)
})




// // Listen for users and guests connecting to the network
// unifi.on('connected', (data) => {
//     console.log('connect')
//   // console.log(data)
// })

// // Listen for users and guests disconnecting from the network
// unifi.on('disconnected', (data) => {
//     console.log('disconnect')
//   // console.log(data)
// })
// unifi.on('EVT_AD_LOGIN', (data) => {
//     console.log('ad_login')
//   // console.log(data)
// })

// // Listen for any event
// unifi.on('event', (data) => {
//   //console.log(data)
// })
