const SocketIO = require('socket.io-client')
const config = require('./config')
const log = config.log
const fingerTable = require('./finger-table')
const connSwitch = require('./connection-switch')
const channel = require('./channel')
const stream = require('stream')
const Duplex = stream.Duplex
const peerId = config.peerId

console.log('My peerId:', peerId.toHex())

var io

exports = module.exports

exports.dial = (dstId, callback) => {
  // create a duplex passthrough stream
  // create a conn
  // write a SYN to conn.out
  // when a ACK arrives
  //   conn.inc.pipe(ds)
  //   ds.pipe(conn.out)
  //   callback(to signal that it is ready)
  //
  var set = false
  var reader

  const conn = connSwitch.createConn(peerId.toHex(), dstId)
  console.log('Sending SYN to:', dstId)
  conn.out.write('SYN')

  conn.inc.once('data', (data) => {
    console.log('received ACK:', data)
    conn.inc.on('data', (data) => {
      reader.push(data)
    })
    if (callback) {
      callback(ds)
    }
  })

  const ds = new Duplex({
    read: function (n) {
      if (set) {
        return
      }
      set = true
      reader = this
    },
    write: function (chunk, enc, next) {
      conn.out.write(chunk)
    }
  })

  return ds
}

exports.createListener = (options, callback) => {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  connSwitch.setIncConnCB((conn) => {
    // ACK
    // create duplexStream
    // ds.pipe(conn.out)
    // conn.inc.pipe(ds)
    // callback(ds)
    var set = false
    const ds = new Duplex({
      read: function (n) {
        if (set) {
          return
        }
        set = true
        conn.inc.on('data', (data) => {
          this.push(data)
        })
      },
      write: function (chunk, enc, next) {
        conn.out.write(chunk)
      }
    })

    conn.out.write('ACK')
    callback(ds)
  })

  return {
    listen: (callback) => {
      // connect and join (gen Id first), wait to be established, then go
      connect(options.url || 'http://localhost:9000', (err) => {
        if (err) {}
        join(callback)
      })
    }
  }
}

// update a finger by asking the sig-server what is the new best
exports.updateFinger = (row) => {
  // TODO
  // 1. send a request for a finger Update on a specific row
}

// update every row to a new best
exports.updateFingerTable = () => {
  // TODO
  // 1. send a request by each Finger Row that I'm already using
}

exports.getFingerTable = () => {
  return fingerTable.table
}

// connect to the sig-server
function connect (url, callback) {
  io = SocketIO.connect(url)
  io.on('connect', callback)
}

// join the peerTable of the sig-server
function join (callback) {
  log('connected to sig-server')
  io.emit('ss-join', {
    peerId: config.peerId.toHex(),
    notify: true
  })
  io.on('we-update-finger', fingerTable.updateFinger(io))
  io.on('we-handshake', channel.accept(io))

  io.once('we-ready', callback)
}
