const UnifiEvents = require('unifi-events')
const rp = require('request-promise')


const requireEnv = (key) => {
  if(!process.env[key]) {
    console.log("Missing configuration " + key)
    process.exit(1)
  }
  return process.env[key]
}
let webhook = requireEnv('SLACK_WEBHOOK')

let unifi = new UnifiEvents({
  controller: requireEnv('UNIFI_CONTROLLER'),
  username: requireEnv('UNIFI_USERNAME'),
  password: requireEnv('UNIFI_PASSWORD'),
  site: process.env.UNIFI_SITE || 'default',
  rejectUnauthorized: false
  })

let registeredEvents = []

const isMacAddress = (addr) => {
  return addr.match(/([a-fA-F0-9]{2}:){5}[a-fA-F0-9]{2}/)
}



const sendNotification = (text) => {
  return rp.post(webhook, {
    json: {
      text: text,
      username: 'UniFi Notify'
    }
  })
  .then(() => {
    console.log(text)
  })
  .catch((err) => {
    console.log(err)
  })
}

const callback = (data) => {
  if (data.key === 'EVT_WG_Connected') {
    let client = data.msg.match(/Guest\[(.*?)\]/)[1]
    let ap = data.msg.match(/AP\[(.*?)\]/)[1]

    let clientValuePromise = isMacAddress(client) ? unifi.getClient(client) : Promise.resolve(client)
    let apValuePromise = isMacAddress(ap) ? unifi.getAp(ap) : Promise.resolve(ap)

    Promise.all([clientValuePromise, apValuePromise]).then(values => {
      let newClientName = values[0] && values[0].name ? values[0].name : values[0].hostname ? values[0].hostname : client
      let newApName = values[1] && values[1].name ? values[1].name : ap
      
      sendNotification(data.msg.replace(client, newClientName).replace(ap, newApName))
    })

  } else {
    sendNotification(data.msg)
  }

}

const _registerListeners = (eventConfig) => {
  registeredEvents.forEach(event => {
    unifi.removeListener(event, callback)
  })

  registeredEvents = Object.keys(eventConfig).filter(key => key.startsWith('EVT_')).filter(key => eventConfig[key].push_enabled)

  registeredEvents.forEach(event => {
    unifi.on(event, callback)
  })
}

unifi.getNotificationConfiguration().then(data => {
  let eventConfig = data.data.find(elem => elem.key == 'super_events')

  _registerListeners(eventConfig)
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

unifi.on('super_events', data => {
  console.log("Notification preferences updated.  Re-subscribing...")
  _registerListeners(data)
})

// // Listen for any event
// unifi.on('event', (data) => {
//   //console.log(data)
// })
