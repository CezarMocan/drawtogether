import express from 'express'
import next from 'next'
import bodyParser from 'body-parser'
import ioModule from 'socket.io'
import httpModule from 'http'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const MAX_COLS = 4
let sox = {}

app.prepare().then(() => {
  const server = express()
  server.use(bodyParser.json())
  server.use(bodyParser.urlencoded({ extended: true }))
  var http = httpModule.Server(server)
  var io = ioModule(http)
  var port = process.env.PORT || 3000;

  if (process.env.NODE_ENV === "production") {
    server.get(
      /^\/_next\/static\//,
      (_, res, nextHandler) => {
        res.setHeader(
          "Cache-Control",
          "public, max-age=31536000, immutable",
        );
        nextHandler();
      },
    );
  }

  server.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  })

  server.get('*', (req, res, next) => {
    return handle(req, res)
  })

  http.listen(port, function(){
    console.log('listening on *:', port)
  })

  let refreshGrid = () => {
    const active = Object.values(sox).filter(s => !s.observer)
    const rows = Math.floor((active.length - 1) / MAX_COLS) + 1
    const last = active.length - 1
    active.forEach((s, i) => {
      if (s.observer) return
      s.row = Math.floor(i / MAX_COLS)
      s.col = i % MAX_COLS
      const width = (s.row == Math.floor(last / MAX_COLS) && (active.length % MAX_COLS != 0)) ? (1.0 / (active.length % MAX_COLS)) : (1.0 / MAX_COLS)
      s.bounds = {
        x: s.col * width,
        y: s.row / rows,
        w: width,
        h: (1.0 / rows)        
      }
    })

    let data = {}
    Object.keys(sox).forEach(k => {
      if (sox[k].observer) return
      data[k] = {}
      data[k].socketId = sox[k].socket.id
      data[k].row = sox[k].row
      data[k].col = sox[k].col
      data[k].name = sox[k].name
      data[k].bounds = sox[k].bounds
    })

    io.emit('state', data)
  }

  // A client connected to the socket
  io.on('connection', (socket) => {
    sox[socket.id] = {
      socket,
      name: socket.id
    }
    refreshGrid()

    socket.on('name', (data) => {
      sox[socket.id].name = data.name
      sox[socket.id].observer = data.observer
      refreshGrid()
    })

    socket.on( 'startPath', (data, sessionId ) => {
      socket.broadcast.emit( 'startPath', data, sessionId );
    });

    // A User continues a path
    socket.on( 'continuePath', (data, sessionId ) => {
      socket.broadcast.emit( 'continuePath', data, sessionId );
    });

    // A user ends a path
    socket.on( 'endPath', (data, sessionId ) => {
      socket.broadcast.emit( 'endPath', data, sessionId );
    });

    socket.on('sendNewPrompt', (data) => {
      io.emit('newPrompt', data)
    })

    socket.on('sendFinishPrompt', (data) => {
      io.emit('finishPrompt')
    })

    socket.on('disconnect', () => {
      delete sox[socket.id]
      refreshGrid()
    })
  })

  // Get messages saved in the creatures
  server.get('/savedMessages', (req, res, next) => {
    res.send('Pula')
  })

})
